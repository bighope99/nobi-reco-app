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

    // 1. 活動記録を保存
    const { data: activity, error: activityError } = await supabase
      .from('r_activity')
      .insert({
        facility_id: session.current_facility_id,
        class_id: class_id || null,
        activity_date,
        title: title || null,
        content,
        mentioned_children,
        created_by: session.user_id,
      })
      .select()
      .single();

    if (activityError) {
      console.error('Activity insert error:', activityError);
      return NextResponse.json(
        { error: activityError.message },
        { status: 500 }
      );
    }

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
            facility_id: session.current_facility_id,
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
