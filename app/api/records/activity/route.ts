import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { decryptChildId } from '@/utils/crypto/childIdEncryption';
import { extractChildContent } from '@/lib/ai/contentExtractor';
import { validateActivityExtendedFields } from '@/lib/validation/activityValidation';
import type { DailyScheduleItem, RoleAssignment, Meal } from '@/types/activity';

/**
 * 保育日誌を保存し、メンションされた子供の個別記録を自動生成
 *
 * 処理フロー：
 * 1. 保育日誌をr_activityテーブルに保存
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
      event_name,
      daily_schedule,
      role_assignments,
      special_notes,
      snack,
      meal,
      todo_items,
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
          .map((photo: Record<string, unknown>) => {
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

    // 新規フィールドのバリデーション
    const extendedFieldsResult = validateActivityExtendedFields({
      event_name,
      daily_schedule,
      role_assignments,
      special_notes,
      snack,
      meal,
      todo_items,
    });

    if (!extendedFieldsResult.valid) {
      return NextResponse.json(
        { error: extendedFieldsResult.error },
        { status: 400 }
      );
    }

    const validatedFields = extendedFieldsResult.data;

    const ensureActivityRecord = async () => {
      if (activity_id) {
        const { data: existingActivity, error: fetchError } = await supabase
          .from('r_activity')
          .select('id, facility_id')
          .eq('id', activity_id)
          .is('deleted_at', null)
          .single();

        if (fetchError || !existingActivity) {
          return { error: '保育日誌が見つかりませんでした', status: 404 };
        }

        if (existingActivity.facility_id !== session.current_facility_id) {
          return { error: 'この保育日誌にアクセスする権限がありません', status: 403 };
        }

        const updatePayload: Record<string, unknown> = {
          activity_date,
          title: title || null,
          content,
          class_id: class_id || null,
          mentioned_children,
          updated_at: new Date().toISOString(),
          event_name: validatedFields.event_name,
          daily_schedule: validatedFields.daily_schedule,
          role_assignments: validatedFields.role_assignments,
          special_notes: validatedFields.special_notes,
          snack: validatedFields.snack,
          meal: validatedFields.meal,
          todo_items: validatedFields.todo_items,
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
        event_name: validatedFields.event_name,
        daily_schedule: validatedFields.daily_schedule,
        role_assignments: validatedFields.role_assignments,
        special_notes: validatedFields.special_notes,
        snack: validatedFields.snack,
        meal: validatedFields.meal,
        todo_items: validatedFields.todo_items,
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

      const previewErrors: Array<{ token?: string; childId?: string; error: string }> = [];

      const previewResults = await Promise.allSettled(
        mentioned_children.map(async (encryptedToken) => {
          const childId = decryptChildId(encryptedToken);
          if (!childId) {
            throw Object.assign(new Error('Decryption failed'), { token: encryptedToken });
          }
          const childContent = await extractChildContent(content, childId, encryptedToken);
          return { child_id: childId, content: childContent, observation_date: activity_date };
        })
      );

      const previewObservations: Array<{ child_id: string; content: string; observation_date: string }> = [];
      previewResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          previewObservations.push(result.value);
        } else {
          const err = result.reason as Error & { token?: string; childId?: string };
          console.error(`AI extraction error in preview:`, err);
          previewErrors.push({
            ...(err.token ? { token: err.token } : { token: mentioned_children[i] }),
            error: err.message || 'Unknown error',
          });
        }
      });

      return NextResponse.json({
        success: true,
        mode: 'preview',
        activity: ensured.activity,
        observations: previewObservations,
        message:
          previewErrors.length > 0
            ? 'AI解析が一部の児童で失敗しました。結果を確認してください。'
            : 'AI解析結果を確認し、必要な児童のみ許可してください。',
        ...(previewErrors.length > 0 && { errors: previewErrors }),
      });
    }

    // 1. 保育日誌を保存
    const ensured = await ensureActivityRecord();
    if ('error' in ensured) {
      return NextResponse.json({ error: ensured.error }, { status: ensured.status });
    }
    const activity = ensured.activity;

    // 2. 各子供のAI抽出を並列実行
    const extractionErrors: Array<{ token?: string; childId?: string; error: string }> = [];

    const extractionResults = await Promise.allSettled(
      mentioned_children.map(async (encryptedToken) => {
        const childId = decryptChildId(encryptedToken);
        if (!childId) {
          console.error('Failed to decrypt child ID:', encryptedToken);
          throw Object.assign(new Error('Decryption failed'), { token: encryptedToken });
        }
        const childContent = await extractChildContent(content, childId, encryptedToken);
        return { child_id: childId, content: childContent };
      })
    );

    // 抽出成功分をバッチinsert
    const insertRows: Array<{ child_id: string; observation_date: string; content: string; activity_id: string; created_by: string }> = [];
    extractionResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        insertRows.push({
          child_id: result.value.child_id,
          observation_date: activity_date,
          content: result.value.content,
          activity_id: activity.id,
          created_by: session.user_id,
        });
      } else {
        const err = result.reason as Error & { token?: string; childId?: string };
        console.error(`AI extraction error for child:`, err);
        extractionErrors.push({
          ...(err.token ? { token: err.token } : { token: mentioned_children[i] }),
          error: err.message || 'Unknown error',
        });
      }
    });

    let observations: unknown[] = [];
    if (insertRows.length > 0) {
      const { data: inserted, error: obsError } = await supabase
        .from('r_observation')
        .insert(insertRows)
        .select();
      if (obsError) {
        console.error('Observation batch insert error:', obsError);
        extractionErrors.push({ error: obsError.message });
      } else {
        observations = inserted || [];
      }
    }

    return NextResponse.json({
      success: true,
      activity,
      observations,
      message: `保育日誌を保存し、${observations.length}件の個別記録を生成しました`,
      ...(extractionErrors.length > 0 && { errors: extractionErrors }),
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
 * 保育日誌を更新
 *
 * 処理フロー：
 * 1. 既存の保育日誌を取得して権限チェック
 * 2. 保育日誌を更新（mentioned_childrenも含む）
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
      event_name,
      daily_schedule,
      role_assignments,
      special_notes,
      snack,
      meal,
      todo_items,
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

    // 新規フィールドのバリデーション
    const extendedFieldsResult = validateActivityExtendedFields({
      event_name,
      daily_schedule,
      role_assignments,
      special_notes,
      snack,
      meal,
      todo_items,
    });

    if (!extendedFieldsResult.valid) {
      return NextResponse.json(
        { error: extendedFieldsResult.error },
        { status: 400 }
      );
    }

    const validatedFields = extendedFieldsResult.data;

    // 1. 既存の保育日誌を取得して権限チェック
    const { data: existingActivity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id, created_by')
      .eq('id', activity_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingActivity) {
      return NextResponse.json(
        { error: '保育日誌が見つかりませんでした' },
        { status: 404 }
      );
    }

    // 施設IDチェック
    if (existingActivity.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'この保育日誌を更新する権限がありません' },
        { status: 403 }
      );
    }

    // 2. 保育日誌を更新
    const { data: updatedActivity, error: updateError } = await supabase
      .from('r_activity')
      .update({
        activity_date,
        title: title || null,
        content,
        class_id: class_id || null,
        mentioned_children,
        updated_at: new Date().toISOString(),
        event_name: validatedFields.event_name,
        daily_schedule: validatedFields.daily_schedule,
        role_assignments: validatedFields.role_assignments,
        special_notes: validatedFields.special_notes,
        snack: validatedFields.snack,
        meal: validatedFields.meal,
        todo_items: validatedFields.todo_items,
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
      message: '保育日誌を更新しました',
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
 * 保育日誌を削除（ソフトデリート）
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
        { error: '保育日誌が見つかりませんでした' },
        { status: 404 }
      );
    }

    if (existingActivity.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'この保育日誌を削除する権限がありません' },
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
      message: '保育日誌を削除しました',
    });
  } catch (error) {
    console.error('Activity DELETE API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
