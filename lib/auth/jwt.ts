import { createClient } from '@/utils/supabase/server';

/**
 * JWTメタデータの型定義
 */
export interface JWTMetadata {
  user_id: string;
  role: 'site_admin' | 'company_admin' | 'facility_admin' | 'staff';
  company_id: string;
  current_facility_id: string | null; // site_admin・company_adminの場合はnullの可能性あり
}

/**
 * JWTトークン（Base64URL形式）をデコードしてペイロードを返す
 * Node.js環境では Buffer を使用
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 認証済みユーザーのJWTメタデータを取得
 *
 * getSession() でアクセストークンを取得し、JWTペイロードを直接デコードして
 * Custom Access Token Hook で追加されたカスタムクレームを取得します。
 * session.user.app_metadata ではカスタムクレームが取得できないため、
 * JWTトークンを直接デコードする必要があります。
 *
 * @returns JWTメタデータまたはnull（認証エラー時）
 */
export async function getAuthenticatedUserMetadata(): Promise<JWTMetadata | null> {
  const supabase = await createClient();

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    if (error) {
      console.error('Failed to get session:', error.message);
    }
    return null;
  }

  const payload = decodeJwtPayload(session.access_token);
  if (!payload) {
    console.error('Failed to decode JWT payload');
    return null;
  }

  const appMetadata = payload.app_metadata as Record<string, unknown> | undefined;
  const user_id = payload.sub as string | undefined;
  const role = appMetadata?.role as string | undefined;
  const company_id = appMetadata?.company_id as string | undefined;
  const current_facility_id = (appMetadata?.current_facility_id as string | null | undefined) ?? null;

  const validRoles = ['site_admin', 'company_admin', 'facility_admin', 'staff'] as const;
  type ValidRole = typeof validRoles[number];

  // 必須フィールドの検証
  if (!user_id || !role || !company_id) {
    console.error('Missing required JWT claims: user_id, role or company_id');
    return null;
  }

  if (!validRoles.includes(role as ValidRole)) {
    console.error('Invalid role in JWT claims:', role);
    return null;
  }

  if (role !== 'site_admin' && role !== 'company_admin' && !current_facility_id) {
    // site_admin・company_admin以外は施設IDが必須
    console.error('Missing required JWT claim: current_facility_id for non-site_admin/company_admin user');
    return null;
  }

  return {
    user_id,
    role: role as ValidRole,
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
