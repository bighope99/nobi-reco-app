import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt';

/**
 * 施設へのアクセス権限を確認する
 * - site_admin: 全施設にアクセス可
 * - company_admin: 自社施設のみ
 * - facility_admin / staff: 自施設のみ（current_facility_id 一致）
 */
async function checkFacilityAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  metadata: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUserMetadata>>>,
  facilityId: string
): Promise<boolean> {
  if (metadata.role === 'site_admin') return true;

  if (metadata.role === 'company_admin') {
    const { data: facility } = await supabase
      .from('m_facilities')
      .select('company_id')
      .eq('id', facilityId)
      .is('deleted_at', null)
      .single();
    return facility?.company_id === metadata.company_id;
  }

  return metadata.current_facility_id === facilityId;
}

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

    const body = await request.json();
    const roleName = body.role_name?.trim();

    if (!roleName) {
      return NextResponse.json({ error: 'role_name is required' }, { status: 400 });
    }

    if (roleName.length > 50) {
      return NextResponse.json({ error: 'role_name must be 50 characters or less' }, { status: 400 });
    }

    // 既存の同一 role_name を確認（論理削除済みを含まない）
    const { data: existing } = await supabase
      .from('m_role_presets')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('role_name', roleName)
      .is('deleted_at', null)
      .single();

    if (existing) {
      return NextResponse.json({ preset: existing, skipped: true });
    }

    // sort_order: 現在の最大値 + 1
    const { data: maxOrderData } = await supabase
      .from('m_role_presets')
      .select('sort_order')
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = maxOrderData ? maxOrderData.sort_order + 1 : 0;

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
