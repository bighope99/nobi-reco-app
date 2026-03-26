import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt';

/**
 * DELETE /api/facilities/:facility_id/role-presets/:preset_id
 * 役割プリセットを論理削除
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ facility_id: string; preset_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { facility_id: facilityId, preset_id: presetId } = await params;

    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(metadata, ['facility_admin', 'company_admin', 'site_admin'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // site_admin・company_admin は全施設にアクセス可、それ以外は自施設のみ
    if (metadata.role !== 'site_admin' && metadata.role !== 'company_admin') {
      if (metadata.current_facility_id !== facilityId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (metadata.role === 'company_admin') {
      // company_admin は自社施設のみに制限
      const { data: facility } = await supabase
        .from('m_facilities')
        .select('company_id')
        .eq('id', facilityId)
        .is('deleted_at', null)
        .single();
      if (facility?.company_id !== metadata.company_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('m_role_presets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', presetId)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role preset:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
