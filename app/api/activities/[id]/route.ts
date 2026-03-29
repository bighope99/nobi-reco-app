import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { normalizePhotos } from '@/lib/utils/photos';
import { findInvalidUUIDs } from '@/lib/utils/validation';
import { validateActivityExtendedFields } from '@/lib/validation/activityValidation';
import type { DailyScheduleItem, RoleAssignment, Meal, TodoItem } from '@/types/activity';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';

const ACTIVITY_PHOTO_BUCKET = 'private-activity-photos';
const SIGNED_URL_EXPIRES_IN = 300;

// Content validation constants
const MAX_CONTENT_LENGTH = 10000;
const MAX_TITLE_LENGTH = 100;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

interface ActivityUpdateData {
  updated_by: string;
  updated_at: string;
  activity_date?: string;
  class_id?: string | null;
  title?: string;
  content?: string;
  snack?: string | null;
  mentioned_children?: string[];
  photos?: Array<{ url: string; caption?: string | null; thumbnail_url?: string | null; file_id?: string; file_path?: string }>;
  event_name?: string | null;
  daily_schedule?: DailyScheduleItem[] | null;
  role_assignments?: RoleAssignment[] | null;
  special_notes?: string | null;
  handover?: string | null;
  todo_items?: TodoItem[] | null;
  meal?: Meal | null;
  recorded_by?: string | null;
}

const signActivityPhotos = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  facilityId: string,
  photos: unknown
) => {
  if (!Array.isArray(photos)) return photos || [];

  const signedPhotos = await Promise.all(
    photos.map(async (photo) => {
      if (!photo || typeof photo !== 'object') return photo;

      const filePath =
        'file_path' in photo && typeof photo.file_path === 'string'
          ? photo.file_path
          : null;

      if (!filePath || !filePath.startsWith(`${facilityId}/`)) {
        return photo;
      }

      const { data: signed, error } = await supabase.storage
        .from(ACTIVITY_PHOTO_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_EXPIRES_IN);

      if (error || !signed) {
        console.error('Failed to sign activity photo URL:', error);
        return photo;
      }

      return {
        ...photo,
        url: signed.signedUrl,
        thumbnail_url: signed.signedUrl,
        expires_in: SIGNED_URL_EXPIRES_IN,
      };
    })
  );

  return signedPhotos;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { id: activityId } = await context.params;

    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const facility_id = metadata.current_facility_id;

    const { data: activity, error } = await supabase
      .from('r_activity')
      .select(`
        id,
        activity_date,
        title,
        content,
        snack,
        photos,
        class_id,
        mentioned_children,
        event_name,
        daily_schedule,
        role_assignments,
        special_notes,
        handover,
        meal,
        recorded_by,
        created_at,
        updated_at,
        m_classes (
          id,
          name
        ),
        m_users!r_activity_created_by_fkey (
          id,
          name
        ),
        recorded_by_user:m_users!recorded_by(id, name)
      `)
      .eq('id', activityId)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single();

    if (error || !activity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found or access denied' },
        { status: 404 }
      );
    }

    const [observationsResult, mentionedChildrenResult] = await Promise.all([
      supabase
        .from('r_observation')
        .select(`
          id,
          activity_id,
          child_id,
          m_children (
            family_name,
            given_name,
            nickname
          )
        `)
        .eq('activity_id', activityId)
        .is('deleted_at', null),
      Array.isArray(activity.mentioned_children) && activity.mentioned_children.length > 0
        ? supabase
            .from('m_children')
            .select('id, family_name, given_name, nickname')
            .in('id', activity.mentioned_children)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (observationsResult.error) {
      console.error('Failed to fetch observations:', observationsResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity observations' },
        { status: 500 }
      );
    }

    if (mentionedChildrenResult.error) {
      console.error('Failed to fetch mentioned children:', mentionedChildrenResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch mentioned children' },
        { status: 500 }
      );
    }

    const mentionedChildrenNamesMap = new Map<string, string>();
    (mentionedChildrenResult.data || []).forEach((child: {
      id: string;
      family_name: string | null;
      given_name: string | null;
      nickname: string | null;
    }) => {
      const familyName = decryptOrFallback(child.family_name) ?? '';
      const givenName = decryptOrFallback(child.given_name) ?? '';
      const displayName = child.nickname || formatName([familyName, givenName]) || '';
      mentionedChildrenNamesMap.set(child.id, displayName);
    });

    const individualRecords = (observationsResult.data || []).map((obs: {
      id: string;
      child_id: string;
      m_children:
        | {
            family_name: string | null;
            given_name: string | null;
            nickname: string | null;
          }
        | Array<{
            family_name: string | null;
            given_name: string | null;
            nickname: string | null;
          }>
        | null;
    }) => {
      const child = Array.isArray(obs.m_children) ? obs.m_children[0] : obs.m_children;
      const childName = child?.nickname || formatName([
        decryptOrFallback(child?.family_name),
        decryptOrFallback(child?.given_name),
      ], '不明');

      return {
        observation_id: obs.id,
        child_id: obs.child_id,
        child_name: childName,
      };
    });

    const activityClass = Array.isArray(activity.m_classes)
      ? activity.m_classes[0]
      : activity.m_classes;
    const createdByUser = Array.isArray(activity.m_users)
      ? activity.m_users[0]
      : activity.m_users;
    const recordedByUser = Array.isArray(activity.recorded_by_user)
      ? activity.recorded_by_user[0]
      : activity.recorded_by_user;

    return NextResponse.json({
      success: true,
      data: {
        activity: {
          activity_id: activity.id,
          activity_date: activity.activity_date,
          title: activity.title || '無題',
          content: activity.content,
          snack: activity.snack,
          photos: await signActivityPhotos(supabase, facility_id, activity.photos || []),
          class_id: activity.class_id,
          class_name: activityClass?.name || '',
          mentioned_children: activity.mentioned_children || [],
          mentioned_children_names: (activity.mentioned_children || []).reduce(
            (acc: Record<string, string>, childId: string) => {
              const name = mentionedChildrenNamesMap.get(childId);
              if (name) {
                acc[childId] = name;
              }
              return acc;
            },
            {} as Record<string, string>
          ),
          event_name: activity.event_name,
          daily_schedule: activity.daily_schedule,
          role_assignments: activity.role_assignments,
          special_notes: activity.special_notes,
          handover: activity.handover,
          meal: activity.meal,
          recorded_by: activity.recorded_by || null,
          recorded_by_name: recordedByUser?.name || null,
          created_by: createdByUser?.name || '',
          created_at: activity.created_at,
          individual_record_count: individualRecords.length,
          individual_records: individualRecords,
        },
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { id: activityId } = await context.params;

    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const facility_id = metadata.current_facility_id;
    const user_id = metadata.user_id;

    const body = await request.json();
    const { activity_date, class_id, title, content, snack, mentioned_children, photos,
      event_name, daily_schedule, role_assignments, special_notes, handover, todo_items, meal, recorded_by } = body;

    // Content length validation
    if (content !== undefined && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Title length validation
    if (title !== undefined && typeof title === 'string' && title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters` },
        { status: 400 }
      );
    }

    // 保育日誌の存在確認と権限チェック
    const { data: existingActivity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id, created_by')
      .eq('id', activityId)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingActivity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found or access denied' },
        { status: 404 }
      );
    }

    if (photos && !Array.isArray(photos)) {
      return NextResponse.json(
        { success: false, error: 'photos must be an array' },
        { status: 400 }
      );
    }

    if (Array.isArray(photos) && photos.length > 6) {
      return NextResponse.json(
        { success: false, error: '写真は最大6枚までです' },
        { status: 400 }
      );
    }

    // mentioned_children のバリデーション
    if (mentioned_children !== undefined) {
      if (!Array.isArray(mentioned_children)) {
        return NextResponse.json(
          { success: false, error: 'mentioned_children must be an array' },
          { status: 400 }
        );
      }
      if (mentioned_children.length > 0) {
        const invalidIds = findInvalidUUIDs(mentioned_children);
        if (invalidIds.length > 0) {
          return NextResponse.json(
            { success: false, error: 'Invalid child IDs in mentioned_children' },
            { status: 400 }
          );
        }
      }
    }

    // mentioned_children が facility に所属しているか確認
    if (mentioned_children && Array.isArray(mentioned_children) && mentioned_children.length > 0) {
      const { data: mentionedChildrenData, error: mentionedChildrenError } = await supabase
        .from('m_children')
        .select('id')
        .in('id', mentioned_children)
        .eq('facility_id', facility_id)
        .is('deleted_at', null);

      if (mentionedChildrenError || !mentionedChildrenData || mentionedChildrenData.length !== mentioned_children.length) {
        return NextResponse.json(
          { success: false, error: 'One or more child IDs are invalid or do not belong to this facility' },
          { status: 400 }
        );
      }
    }

    const normalizedPhotos = normalizePhotos(photos) ?? undefined;

    // class_id の空文字を null に正規化
    const normalizedClassId = class_id === '' ? null : class_id;

    // class_id が指定されている場合、facility に所属しているか確認
    if (normalizedClassId) {
      const { data: classData, error: classError } = await supabase
        .from('m_classes')
        .select('id')
        .eq('id', normalizedClassId)
        .eq('facility_id', facility_id)
        .is('deleted_at', null)
        .single();

      if (classError || !classData) {
        return NextResponse.json(
          { success: false, error: 'Invalid class_id or class does not belong to this facility' },
          { status: 400 }
        );
      }
    }

    // 新規フィールドのバリデーション
    const extendedFieldsResult = validateActivityExtendedFields({
      event_name,
      daily_schedule,
      role_assignments,
      special_notes,
      handover,
      todo_items,
      snack,
      meal,
    });

    if (!extendedFieldsResult.valid) {
      return NextResponse.json(
        { success: false, error: extendedFieldsResult.error },
        { status: 400 }
      );
    }

    const validatedFields = extendedFieldsResult.data;

    const sanitizeUuid = (value: unknown): string | null =>
      (typeof value === 'string' && value.trim()) ? value : null;

    // 更新データの準備
    const updateData: ActivityUpdateData = {
      updated_by: user_id,
      updated_at: new Date().toISOString(),
    };

    if (activity_date !== undefined) updateData.activity_date = activity_date;
    if (class_id !== undefined) updateData.class_id = normalizedClassId;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (snack !== undefined) updateData.snack = validatedFields.snack;
    if (mentioned_children !== undefined) updateData.mentioned_children = mentioned_children;
    if (normalizedPhotos !== undefined) updateData.photos = normalizedPhotos;
    if (event_name !== undefined) updateData.event_name = validatedFields.event_name;
    if (daily_schedule !== undefined) updateData.daily_schedule = validatedFields.daily_schedule;
    if (role_assignments !== undefined) updateData.role_assignments = validatedFields.role_assignments;
    if (special_notes !== undefined) updateData.special_notes = validatedFields.special_notes;
    if (handover !== undefined) updateData.handover = validatedFields.handover;
    if (todo_items !== undefined) updateData.todo_items = validatedFields.todo_items;
    if (meal !== undefined) updateData.meal = validatedFields.meal;
    if (recorded_by !== undefined) updateData.recorded_by = sanitizeUuid(recorded_by);

    // 保育日誌を更新
    const { data: updatedActivity, error: updateError } = await supabase
      .from('r_activity')
      .update(updateData)
      .eq('id', activityId)
      .select()
      .single();

    if (updateError) {
      console.error('Activity update error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update activity' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        activity_id: updatedActivity.id,
        activity_date: updatedActivity.activity_date,
        title: updatedActivity.title,
        content: updatedActivity.content,
        snack: updatedActivity.snack,
        event_name: updatedActivity.event_name,
        daily_schedule: updatedActivity.daily_schedule,
        role_assignments: updatedActivity.role_assignments,
        special_notes: updatedActivity.special_notes,
        handover: updatedActivity.handover,
        meal: updatedActivity.meal,
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { id: activityId } = await context.params;

    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const facility_id = metadata.current_facility_id;
    const user_id = metadata.user_id;

    // 保育日誌の存在確認と権限チェック
    const { data: existingActivity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id')
      .eq('id', activityId)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingActivity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found or access denied' },
        { status: 404 }
      );
    }

    // 論理削除
    const { error: deleteError } = await supabase
      .from('r_activity')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user_id,
      })
      .eq('id', activityId);

    if (deleteError) {
      console.error('Activity delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete activity' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Activity deleted successfully',
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
