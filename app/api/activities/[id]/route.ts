import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { normalizePhotos } from '@/lib/utils/photos';
import { findInvalidUUIDs } from '@/lib/utils/validation';

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
      event_name, daily_schedule, role_assignments, special_notes, meal } = body;

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

    // 活動記録の存在確認と権限チェック
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

    // class_id が指定されている場合、facility に所属しているか確認
    if (class_id) {
      const { data: classData, error: classError } = await supabase
        .from('m_classes')
        .select('id')
        .eq('id', class_id)
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

    // 更新データの準備
    const updateData: any = {
      updated_by: user_id,
      updated_at: new Date().toISOString(),
    };

    if (activity_date !== undefined) updateData.activity_date = activity_date;
    if (class_id !== undefined) updateData.class_id = class_id;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (snack !== undefined) updateData.snack = snack;
    if (mentioned_children !== undefined) updateData.mentioned_children = mentioned_children;
    if (normalizedPhotos !== undefined) updateData.photos = normalizedPhotos;
    if (event_name !== undefined) updateData.event_name = event_name;
    if (daily_schedule !== undefined) updateData.daily_schedule = daily_schedule;
    if (role_assignments !== undefined) updateData.role_assignments = role_assignments;
    if (special_notes !== undefined) updateData.special_notes = special_notes;
    if (meal !== undefined) updateData.meal = meal;

    // 活動記録を更新
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

    // 活動記録の存在確認と権限チェック
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
