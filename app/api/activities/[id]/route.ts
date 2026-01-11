import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

const ACTIVITY_PHOTO_BUCKET = 'private-activity-photos';
const SIGNED_URL_EXPIRES_IN = 300;

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
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // セッションからfacility_idを取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 }
      );
    }

    const facility_id = userSession.current_facility_id;
    const body = await request.json();
    const { activity_date, class_id, title, content, snack, mentioned_children, photos } = body;

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

    const normalizedPhotos = Array.isArray(photos)
      ? photos
          .map((photo: any) => {
            if (!photo || typeof photo.url !== 'string') return null;
            return {
              url: photo.url,
              caption: typeof photo.caption === 'string' ? photo.caption : null,
              thumbnail_url: typeof photo.thumbnail_url === 'string' ? photo.thumbnail_url : null,
              file_id: typeof photo.file_id === 'string' ? photo.file_id : null,
              file_path: typeof photo.file_path === 'string' ? photo.file_path : null,
            };
          })
          .filter(Boolean)
      : undefined;

    // 更新データの準備
    const updateData: any = {
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };

    if (activity_date !== undefined) updateData.activity_date = activity_date;
    if (class_id !== undefined) updateData.class_id = class_id;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (snack !== undefined) updateData.snack = snack;
    if (mentioned_children !== undefined) updateData.mentioned_children = mentioned_children;
    if (normalizedPhotos !== undefined) updateData.photos = normalizedPhotos;

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
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // セッションからfacility_idを取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 }
      );
    }

    const facility_id = userSession.current_facility_id;

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
        updated_by: session.user.id,
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
