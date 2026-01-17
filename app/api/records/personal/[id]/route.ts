import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error: fetchError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        child_id,
        observation_date,
        content,
        objective,
        subjective,
        created_by,
        created_at,
        updated_at,
        m_children!inner (
          facility_id,
          family_name,
          given_name,
          nickname
        ),
        record_tags:_record_tag!observation_id (
          tag_id
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !data) {
      if (fetchError) {
        console.error('Observation fetch error:', fetchError);
      }
      return NextResponse.json(
        { success: false, error: 'データが見つかりませんでした' },
        { status: 404 },
      );
    }

    // m_children は配列の可能性があるため、単一オブジェクトとして取得
    const child = Array.isArray(data.m_children) ? data.m_children[0] : data.m_children;

    if (!child || child.facility_id !== session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // PIIフィールドを復号化（失敗時は平文として扱う - 後方互換性）
  

    const decryptedFamilyName = decryptOrFallback(child.family_name);
    const decryptedGivenName = decryptOrFallback(child.given_name);
    const childName =
      child.nickname ||
      [decryptedFamilyName, decryptedGivenName].filter(Boolean).join(' ') ||
      '';
    const tagFlags = (data.record_tags || []).reduce<Record<string, boolean>>((acc, item) => {
      if (item?.tag_id) {
        acc[item.tag_id] = true;
      }
      return acc;
    }, {});
    const { data: createdByUser } = await supabase
      .from('m_users')
      .select('name')
      .eq('id', data.created_by)
      .single();
    const createdByName = createdByUser?.name || '';

    const { data: recentObservations, error: recentError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        observation_date,
        content,
        created_at,
        record_tags:_record_tag!observation_id (
          tag_id
        )
      `,
      )
      .eq('child_id', data.child_id)
      .is('deleted_at', null)
      .neq('id', data.id)
      .order('observation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Recent observations load error:', recentError);
    }

    const recentIds = (recentObservations || []).map((obs) => obs.id).filter(Boolean);
    let recentTagMap: Record<string, string[]> = {};
    if (recentIds.length > 0) {
      const { data: recentTags, error: recentTagsError } = await supabase
        .from('_record_tag')
        .select('observation_id, tag_id')
        .in('observation_id', recentIds);
      if (recentTagsError) {
        console.error('Recent observation tags load error:', recentTagsError);
      } else {
        recentTagMap = (recentTags || []).reduce<Record<string, string[]>>((acc, row) => {
          if (!row.observation_id || !row.tag_id) {
            return acc;
          }
          if (!acc[row.observation_id]) {
            acc[row.observation_id] = [];
          }
          acc[row.observation_id].push(row.tag_id);
          return acc;
        }, {});
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        child_id: data.child_id,
        child_name: childName,
        observation_date: data.observation_date,
        content: data.content,
        objective: data.objective ?? '',
        subjective: data.subjective ?? '',
        tag_flags: tagFlags,
        created_by: data.created_by,
        created_by_name: createdByName,
        created_at: data.created_at,
        updated_at: data.updated_at,
        recent_observations: (recentObservations || []).map((obs) => ({
          id: obs.id,
          observation_date: obs.observation_date,
          content: obs.content,
          created_at: obs.created_at,
          tag_ids: (() => {
            const fromJoin = Array.isArray(obs.record_tags)
              ? obs.record_tags
                  .map((tag: { tag_id?: string }) => tag.tag_id)
                  .filter(Boolean)
              : [];
            if (fromJoin.length > 0) {
              return fromJoin;
            }
            return recentTagMap[obs.id] || [];
          })(),
        })),
      },
    });
  } catch (error) {
    console.error('Observation detail API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const observationDate = typeof body?.observation_date === 'string' ? body.observation_date.trim() : null;

    if (!content) {
      return NextResponse.json({ success: false, error: '本文を入力してください' }, { status: 400 });
    }

    // Validate observation_date format if provided (YYYY-MM-DD)
    if (observationDate && !/^\d{4}-\d{2}-\d{2}$/.test(observationDate)) {
      return NextResponse.json({ success: false, error: '日付形式が不正です' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        child_id,
        m_children!inner (
          facility_id
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: fetchError?.message || 'データが見つかりませんでした' },
        { status: 404 },
      );
    }

    const child = Array.isArray(existing.m_children) ? existing.m_children[0] : existing.m_children;
    if (!child || child.facility_id !== session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Build update object dynamically
    const updateData: Record<string, unknown> = {
      content,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (observationDate) {
      updateData.observation_date = observationDate;
    }

    const { data: updated, error: updateError } = await supabase
      .from('r_observation')
      .update(updateData)
      .eq('id', id)
      .select('id, content, observation_date, updated_at')
      .single();

    if (updateError || !updated) {
      console.error('Observation update error:', updateError);
      return NextResponse.json({ success: false, error: '更新に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Observation update API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
