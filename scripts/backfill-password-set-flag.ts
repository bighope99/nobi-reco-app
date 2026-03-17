/**
 * 既存ユーザーへのパスワード設定フラグのバックフィル
 *
 * 対象: last_sign_in_at !== null かつ user_metadata.password_set が未設定のユーザー
 * 処理: user_metadata.password_set = true を一括設定
 *
 * 使用方法:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/backfill-password-set-flag.ts
 *
 * 本番実行前に --dry-run フラグで対象ユーザーを確認:
 *   ... npx tsx scripts/backfill-password-set-flag.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

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

async function backfill() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  let page = 1;
  const perPage = 1000;
  let totalProcessed = 0;
  let totalUpdated = 0;

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

    const targets = data.users.filter(
      (user) =>
        user.last_sign_in_at !== null &&
        user.user_metadata?.password_set !== true
    );

    console.log(`Page ${page}: ${data.users.length} users, ${targets.length} targets`);
    totalProcessed += data.users.length;

    for (const user of targets) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update: ${user.email} (${user.id})`);
      } else {
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            password_set: true,
          },
        });
        if (updateError) {
          console.error(`  Failed to update ${user.email}: ${updateError.message}`);
        } else {
          console.log(`  Updated: ${user.email}`);
          totalUpdated++;
        }
      }
    }

    if (data.users.length < perPage) break;
    page++;
  }

  console.log(`\nDone. Processed: ${totalProcessed}, Updated: ${totalUpdated}`);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
