import { createClient } from '@/utils/supabase/server';

/**
 * JWTメタデータの型定義
 */
export interface JWTMetadata {
  role: 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
  company_id: string;
  current_facility_id: string | null; // site_adminの場合はnullの可能性あり
}

/**
 * 認証済みユーザーのJWTメタデータを取得
 *
 * Supabase Auth APIのgetClaims()を使用して、署名検証済みのJWTクレームを取得します。
 * これにより、トークンの改ざんを防ぎ、セキュアな認証を実現します。
 *
 * @returns JWTメタデータまたはnull（認証エラー時）
 */
export async function getAuthenticatedUserMetadata(): Promise<JWTMetadata | null> {
  const supabase = await createClient();

  // getClaimsで署名検証済みのカスタムクレームを取得
  const {
    data: claims,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError) {
    console.error('Failed to get JWT claims:', claimsError.message);
    return null;
  }

  if (!claims) {
    return null;
  }

  // app_metadataからカスタムクレームを取得
  const role = claims.claims.app_metadata?.role as 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
  const company_id = claims.claims.app_metadata?.company_id as string;
  const current_facility_id = claims.claims.app_metadata?.current_facility_id as string | null;

  // 必須フィールドの検証
  // site_adminの場合はcurrent_facility_idがnullでも許可
  if (!role || !company_id) {
    console.error('Missing required JWT claims: role or company_id');
    return null;
  }

  if (role !== 'site_admin' && !current_facility_id) {
    // site_admin以外は施設IDが必須
    console.error('Missing required JWT claim: current_facility_id for non-site_admin user');
    return null;
  }

  return {
    role,
    company_id,
    current_facility_id: current_facility_id || null,
  };
}

/**
 * 権限チェック用のヘルパー
 * @param metadata JWTメタデータ
 * @param allowedRoles 許可するロールの配列
 * @returns 権限があればtrue
 */
export function hasPermission(
  metadata: JWTMetadata,
  allowedRoles: JWTMetadata['role'][]
): boolean {
  return allowedRoles.includes(metadata.role);
}
