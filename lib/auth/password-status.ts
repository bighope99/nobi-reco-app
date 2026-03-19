import type { User } from '@supabase/supabase-js';

/**
 * ユーザーがパスワード設定を完了しているかどうかを返す。
 * Supabase は magic link クリック時点で last_sign_in_at を更新するため、
 * パスワード設定完了の判定には user_metadata.password_set フラグを使用する。
 */
export function hasCompletedPasswordSetup(user: User): boolean {
  return user.user_metadata?.password_set === true;
}
