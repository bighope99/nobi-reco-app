/**
 * パスワード設定フラグ未設定ユーザーの調査スクリプト
 *
 * ⚠️ 自動バックフィル無効 ⚠️
 * last_sign_in_at は magic link クリック時点で更新されるため、
 * パスワード設定完了の判定には使用できない。
 * 自動バックフィルを行うと「リンクをクリックしたがパスワード未設定」の
 * ユーザーを誤って password_set: true に設定してしまう。
 *
 * このスクリプトは password_set フラグが未設定のユーザーを一覧表示するのみ。
 * 個別に確認の上、管理画面から再招待を実施してください。
 *
 * 使用方法:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/backfill-password-set-flag.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listCandidates() {
  console.log('password_set フラグ未設定ユーザーの一覧（参考情報）');
  console.log('※ 自動更新は行いません。管理画面から個別に再招待を実施してください。\n');

  let page = 1;
  const perPage = 1000;
  let totalUsers = 0;
  let candidates = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error('Failed to list users:', error);
      process.exit(1);
    }

    if (data.users.length === 0) break;

    totalUsers += data.users.length;

    for (const user of data.users) {
      if (user.user_metadata?.password_set !== true) {
        const hasSignedIn = user.last_sign_in_at !== null;
        console.log(
          `  ${user.email} (${user.id}) | last_sign_in_at: ${user.last_sign_in_at ?? 'null'} | ` +
          `${hasSignedIn ? 'リンクをクリック済みの可能性あり' : '未クリック'}`
        );
        candidates++;
      }
    }

    if (data.users.length < perPage) break;
    page++;
  }

  console.log(`\n合計: ${totalUsers} ユーザー中 ${candidates} 件が password_set 未設定`);
  console.log('注意: last_sign_in_at があるユーザーはリンクをクリック済みですが、パスワード設定は完了していない可能性があります。');
}

listCandidates().catch((err) => {
  console.error(err);
  process.exit(1);
});
