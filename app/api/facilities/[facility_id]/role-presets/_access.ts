import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * 施設へのアクセス権限を確認する
 * - site_admin: 全施設にアクセス可
 * - company_admin: 自社施設のみ
 * - facility_admin / staff: 自施設のみ（current_facility_id 一致）
 */
export async function checkFacilityAccess(
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
