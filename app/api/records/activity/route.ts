import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { decryptChildId } from '@/utils/crypto/childIdEncryption';
import { extractChildContent } from '@/lib/ai/contentExtractor';

/**
 * 活動記録を保存し、メンションされた子供の個別記録を自動生成
 *
 * 処理フロー：
 * 1. 活動記録をr_activityテーブルに保存
 * 2. mentioned_children配列内の各暗号化トークンを復号化
 * 3. AIで各子供に関連する内容を抽出
 * 4. r_observationテーブルに個別記録を保存
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      content,
      mentioned_children = [],
      activity_date,
      class_id,
      title,
      activity_id,
      ai_preview = false,
      photos,
    } = body;

    // バリデーション
    if (!activity_date || typeof activity_date !== 'string') {
      return NextResponse.json(
        { error: 'activity_date is required and must be a string (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'content is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!Array.isArray(mentioned_children)) {
      return NextResponse.json(
        { error: 'mentioned_children must be an array' },
        { status: 400 }
      );
    }

    if (photos && !Array.isArray(photos)) {
      return NextResponse.json(
        { error: 'photos must be an array' },
        { status: 400 }
      );
    }

    if (Array.isArray(photos) && photos.length > 6) {
      return NextResponse.json(
        { error: '写真は最大6枚までです' },
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
      : null;

    const ensureActivityRecord = async () => {
      if (activity_id) {
        const { data: existingActivity, error: fetchError } = await supabase
          .from('r_activity')
          .select('id, facility_id')
          .eq('id', activity_id)
          .is('deleted_at', null)
          .single();

        if (fetchError || !existingActivity) {
          return { error: '活動記録が見つかりませんでした', status: 404 };
        }

        if (existingActivity.facility_id !== session.current_facility_id) {
          return { error: 'この活動記録にアクセスする権限がありません', status: 403 };
        }

        const updatePayload: Record<string, unknown> = {
          activity_date,
          title: title || null,
          content,
          class_id: class_id || null,
          mentioned_children,
          updated_at: new Date().toISOString(),
        }

        if (Array.isArray(photos)) {
          updatePayload.photos = normalizedPhotos
        }

        const { data: updatedActivity, error: updateError } = await supabase
          .from('r_activity')
          .update(updatePayload)
          .eq('id', activity_id)
          .select()
          .single();

        if (updateError) {
          console.error('Activity update error in preview:', updateError);
          return { error: updateError.message, status: 500 };
        }

        return { activity: updatedActivity };
      }

      const insertPayload: Record<string, unknown> = {
        facility_id: session.current_facility_id,
        class_id: class_id || null,
        activity_date,
        title: title || null,
        content,
        mentioned_children,
        created_by: session.user_id,
      }

      if (Array.isArray(photos)) {
        insertPayload.photos = normalizedPhotos
      }

      const { data: newActivity, error: createError } = await supabase
        .from('r_activity')
        .insert(insertPayload)
        .select()
        .single();

      if (createError) {
        console.error('Activity insert error:', createError);
        return { error: createError.message, status: 500 };
      }

      return { activity: newActivity };
    };

    if (ai_preview) {
      const ensured = await ensureActivityRecord();
      if ('error' in ensured) {
        return NextResponse.json({ error: ensured.error }, { status: ensured.status });
      }

      const previewObservations: Array<{
        child_id: string;
        content: string;
        observation_date: string;
      }> = [];
      const errors = [];

      for (const encryptedToken of mentioned_children) {
        try {
          const childId = decryptChildId(encryptedToken);
          if (!childId) {
            errors.push({
              token: encryptedToken,
              error: 'Decryption failed',
            });
            continue;
          }

          let childContent: string;
          try {
            childContent = await extractChildContent(content, childId, encryptedToken);
          } catch (aiError) {
            console.error(`AI extraction error for child ${childId}:`, aiError);
            errors.push({
              childId,
              error: 'AI extraction failed',
            });
            continue;
          }

          previewObservations.push({
            child_id: childId,
            content: childContent,
            observation_date: activity_date,
          });
        } catch (error) {
          console.error('Unexpected error processing child in preview:', error);
          errors.push({
            token: encryptedToken,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'preview',
        activity: ensured.activity,
        observations: previewObservations,
        message:
          errors.length > 0
            ? 'AI解析が一部の児童で失敗しました。結果を確認してください。'
            : 'AI解析結果を確認し、必要な児童のみ許可してください。',
        ...(errors.length > 0 && { errors }),
      });
    }

    // 1. 活動記録を保存
    const ensured = await ensureActivityRecord();
    if ('error' in ensured) {
      return NextResponse.json({ error: ensured.error }, { status: ensured.status });
    }
    const activity = ensured.activity;

    // 2. 各子供の個別記録を生成
    const observations = [];
    const errors = [];

    for (const encryptedToken of mentioned_children) {
      try {
        // トークンを復号化
        const childId = decryptChildId(encryptedToken);
        if (!childId) {
          console.error('Failed to decrypt child ID:', encryptedToken);
          errors.push({
            token: encryptedToken,
            error: 'Decryption failed',
          });
          continue;
        }

        // AIで子供に関連する内容を抽出
        let childContent: string;
        try {
          childContent = await extractChildContent(content, childId, encryptedToken);
        } catch (aiError) {
          console.error(`AI extraction error for child ${childId}:`, aiError);
          errors.push({
            childId,
            error: 'AI extraction failed',
          });
          continue;
        }

        // 個別記録を保存
        const { data: observation, error: obsError } = await supabase
          .from('r_observation')
          .insert({
            child_id: childId,
            observation_date: activity_date,
            content: childContent,
            activity_id: activity.id, // 元の活動記録IDを保存
            created_by: session.user_id,
          })
          .select()
          .single();

        if (obsError) {
          console.error(`Observation insert error for child ${childId}:`, obsError);
          errors.push({
            childId,
            error: obsError.message,
          });
          continue;
        }

        observations.push(observation);
      } catch (error) {
        console.error('Unexpected error processing child:', error);
        errors.push({
          token: encryptedToken,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      activity,
      observations,
      message: `活動記録を保存し、${observations.length}件の個別記録を生成しました`,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 活動記録を更新
 *
 * 処理フロー：
 * 1. 既存の活動記録を取得して権限チェック
 * 2. 活動記録を更新（mentioned_childrenも含む）
 *
 * 注意：個別記録の再生成は行いません。
 * 個別記録を再生成する場合は、POST /api/records/activityを使用してください。
 */
export async function PUT(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      activity_id,
      content,
      mentioned_children = [],
      activity_date,
      class_id,
      title,
    } = body;

    // バリデーション
    if (!activity_id || typeof activity_id !== 'string') {
      return NextResponse.json(
        { error: 'activity_id is required and must be a string' },
        { status: 400 }
      );
    }

    if (!activity_date || typeof activity_date !== 'string') {
      return NextResponse.json(
        { error: 'activity_date is required and must be a string (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'content is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!Array.isArray(mentioned_children)) {
      return NextResponse.json(
        { error: 'mentioned_children must be an array' },
        { status: 400 }
      );
    }

    // 1. 既存の活動記録を取得して権限チェック
    const { data: existingActivity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id, created_by')
      .eq('id', activity_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingActivity) {
      return NextResponse.json(
        { error: '活動記録が見つかりませんでした' },
        { status: 404 }
      );
    }

    // 施設IDチェック
    if (existingActivity.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'この活動記録を更新する権限がありません' },
        { status: 403 }
      );
    }

    // 2. 活動記録を更新
    const { data: updatedActivity, error: updateError } = await supabase
      .from('r_activity')
      .update({
        activity_date,
        title: title || null,
        content,
        class_id: class_id || null,
        mentioned_children,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activity_id)
      .select()
      .single();

    if (updateError) {
      console.error('Activity update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activity: updatedActivity,
      message: '活動記録を更新しました',
    });
  } catch (error) {
    console.error('Activity PUT API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 活動記録を削除（ソフトデリート）
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { activity_id } = body;

    if (!activity_id || typeof activity_id !== 'string') {
      return NextResponse.json(
        { error: 'activity_id is required and must be a string' },
        { status: 400 }
      );
    }

    const { data: existingActivity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id')
      .eq('id', activity_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingActivity) {
      return NextResponse.json(
        { error: '活動記録が見つかりませんでした' },
        { status: 404 }
      );
    }

    if (existingActivity.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'この活動記録を削除する権限がありません' },
        { status: 403 }
      );
    }

    const deletedAt = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from('r_activity')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', activity_id);

    if (deleteError) {
      console.error('Activity delete error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      activity_id,
      message: '活動記録を削除しました',
    });
  } catch (error) {
    console.error('Activity DELETE API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
