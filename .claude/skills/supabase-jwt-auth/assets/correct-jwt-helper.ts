import { createClient } from '@/utils/supabase/server';

/**
 * JWTメタデータの型定義
 */
export interface JWTMetadata {
  role: 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
  company_id: string;
  current_facility_id: string | null;
}

/**
 * 認証済みユーザーのJWTメタデータを取得
 *
 * 重要: session.user.app_metadataではなく、JWTトークンを直接デコードして取得します。
 * Custom Access Token Hookで追加したカスタムクレームは、session.userには反映されません。
 *
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
  // session.user.app_metadataではカスタムクレームが取得できないため、
  // access_tokenを直接デコードする必要があります
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

  // payloadのapp_metadataからカスタムクレームを取得
  const role = payload.app_metadata?.role as 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
  const company_id = payload.app_metadata?.company_id as string;
  const current_facility_id = payload.app_metadata?.current_facility_id as string | null;

  // 必須フィールドの検証
  if (!role || !company_id) {
    return null;
  }

  // site_admin以外は施設IDが必須
  if (role !== 'site_admin' && !current_facility_id) {
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
 */
export function hasPermission(
  metadata: JWTMetadata,
  allowedRoles: JWTMetadata['role'][]
): boolean {
  return allowedRoles.includes(metadata.role);
}
