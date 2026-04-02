import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { getCurrentDateJST } from '@/lib/utils/timezone';

interface ScheduleUpdate {
  child_id: string;
  schedule: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface BulkUpdateRequest {
  updates: ScheduleUpdate[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { current_facility_id: facility_id } = metadata;
    if (!facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    // リクエストボディをパース
    const body: BulkUpdateRequest = await request.json();

    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: updates array is required' },
        { status: 400 }
      );
    }

    // 全child_idを一括で所属確認（N個のクエリ → 1クエリ）
    const childIds = body.updates.map(u => u.child_id);

    const { data: validChildrenData } = await supabase
      .from('m_children')
      .select('id')
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .in('id', childIds);

    const validChildIds = new Set(validChildrenData?.map(c => c.id) ?? []);

    // 所属外child_idをエラーとして集計
    const invalidResults: Array<{ child_id: string; status: 'success' | 'failed'; error?: string }> =
      body.updates
        .filter(u => !validChildIds.has(u.child_id))
        .map(u => ({
          child_id: u.child_id,
          status: 'failed' as const,
          error: 'Child not found or access denied',
        }));

    const validUpdates = body.updates.filter(u => validChildIds.has(u.child_id));

    // 既存スケジュールを一括取得（N個のクエリ → 1クエリ）
    const validChildIdList = validUpdates.map(u => u.child_id);
    const { data: existingSchedules } = await supabase
      .from('s_attendance_schedule')
      .select('id, child_id')
      .in('child_id', validChildIdList);

    const existingScheduleMap = new Map(
      existingSchedules?.map(s => [s.child_id, s.id]) ?? []
    );

    // UPDATE/INSERT を Promise.all で並列実行
    const upsertResults = await Promise.all(
      validUpdates.map(async ({ child_id, schedule }) => {
        const existingId = existingScheduleMap.get(child_id);
        if (existingId) {
          const { error } = await supabase
            .from('s_attendance_schedule')
            .update({
              monday: schedule.monday,
              tuesday: schedule.tuesday,
              wednesday: schedule.wednesday,
              thursday: schedule.thursday,
              friday: schedule.friday,
              saturday: schedule.saturday,
              sunday: schedule.sunday,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);

          if (error) {
            console.error('Update error:', error);
            return { child_id, status: 'failed' as const, error: error.message };
          }
        } else {
          const { error } = await supabase
            .from('s_attendance_schedule')
            .insert({
              child_id,
              monday: schedule.monday,
              tuesday: schedule.tuesday,
              wednesday: schedule.wednesday,
              thursday: schedule.thursday,
              friday: schedule.friday,
              saturday: schedule.saturday,
              sunday: schedule.sunday,
              valid_from: getCurrentDateJST(),
              is_active: true,
            });

          if (error) {
            console.error('Insert error:', error);
            return { child_id, status: 'failed' as const, error: error.message };
          }
        }
        return { child_id, status: 'success' as const };
      })
    );

    const results = [...invalidResults, ...upsertResults];
    const updated_count = upsertResults.filter(r => r.status === 'success').length;
    const failed_count = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      data: {
        updated_count,
        failed_count,
        results,
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
