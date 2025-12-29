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
 * @returns JWTメタデータまたはnull（認証エラー時）
 */
export async function getAuthenticatedUserMetadata(): Promise<JWTMetadata | null> {
  const supabase = await createClient();

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return null;
  }

  // JWTトークンをデコードしてapp_metadataを取得
  const accessToken = session.access_token;
  const tokenParts = accessToken.split('.');

  if (tokenParts.length < 2) {
    return null;
  }

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
  } catch (error) {
    return null;
  }

  // app_metadataからカスタムクレームを取得
  const role = payload.app_metadata?.role as 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
  const company_id = payload.app_metadata?.company_id as string;
  const current_facility_id = payload.app_metadata?.current_facility_id as string | null;

  // 必須フィールドの検証
  // site_adminの場合はcurrent_facility_idがnullでも許可
  if (!role || !company_id) {
    return null;
  }

  if (role !== 'site_admin' && !current_facility_id) {
    // site_admin以外は施設IDが必須
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
