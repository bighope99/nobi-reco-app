import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt';
import { checkFacilityAccess } from './_access';

/**
 * GET /api/facilities/:facility_id/role-presets
 * 施設の役割プリセット一覧を取得
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ facility_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { facility_id: facilityId } = await params;

    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await checkFacilityAccess(supabase, metadata, facilityId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('m_role_presets')
      .select('id, role_name, sort_order')
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ presets: data });
  } catch (error) {
    console.error('Error fetching role presets:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/facilities/:facility_id/role-presets
 * 役割プリセットを追加（同一 role_name が既存ならスキップ）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ facility_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { facility_id: facilityId } = await params;

    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(metadata, ['facility_admin', 'company_admin', 'site_admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!await checkFacilityAccess(supabase, metadata, facilityId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.role_name !== 'string') {
      return NextResponse.json({ error: 'role_name is required' }, { status: 400 });
    }
    const roleName = body.role_name.trim();

    if (!roleName) {
      return NextResponse.json({ error: 'role_name is required' }, { status: 400 });
    }

    if (roleName.length > 50) {
      return NextResponse.json({ error: 'role_name must be 50 characters or less' }, { status: 400 });
    }

    // 同一 role_name が既に存在するかチェック
    const { data: existing } = await supabase
      .from('m_role_presets')
      .select('id, role_name, sort_order')
      .eq('facility_id', facilityId)
      .eq('role_name', roleName)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ preset: existing, skipped: true });
    }

    // sort_order を採番
    const { data: maxRow } = await supabase
      .from('m_role_presets')
      .select('sort_order')
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

    const { data: inserted, error: insertError } = await supabase
      .from('m_role_presets')
      .insert({
        facility_id: facilityId,
        role_name: roleName,
        sort_order: nextSortOrder,
      })
      .select('id, role_name, sort_order')
      .single();

    if (insertError) {
      // UNIQUE制約違反の場合は既存レコードを返す
      if (insertError.code === '23505') {
        const { data: conflict } = await supabase
          .from('m_role_presets')
          .select('id, role_name, sort_order')
          .eq('facility_id', facilityId)
          .eq('role_name', roleName)
          .is('deleted_at', null)
          .single();
        if (conflict) {
          return NextResponse.json({ preset: conflict, skipped: true });
        }
      }
      throw insertError;
    }

    return NextResponse.json({ preset: inserted }, { status: 201 });
  } catch (error) {
    console.error('Error creating role preset:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
