/**
 * 読み仮名の暗号化データを平文に変換するマイグレーションスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/migrate-phonetic-to-plaintext.ts
 *
 * 環境変数が必要:
 *   - DATABASE_URL または SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - PII_ENCRYPTION_KEY
 *
 * このスクリプトは以下を行います:
 * 1. m_children テーブルの family_name_kana, given_name_kana を復号して平文に更新
 * 2. 既に平文のデータはスキップ（後方互換性）
 */

import { createClient } from '@supabase/supabase-js';
import { decryptPII } from '../utils/crypto/piiEncryption';

const BATCH_SIZE = 100;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  if (!process.env.PII_ENCRYPTION_KEY) {
    console.error('Error: PII_ENCRYPTION_KEY is required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('Starting migration: Decrypting phonetic names (family_name_kana, given_name_kana)...');

  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    // バッチ取得
    const { data: children, error } = await supabase
      .from('m_children')
      .select('id, family_name_kana, given_name_kana')
      .is('deleted_at', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching children:', error.message);
      process.exit(1);
    }

    if (!children || children.length === 0) {
      break;
    }

    console.log(`Processing batch: ${offset + 1} - ${offset + children.length}`);

    for (const child of children) {
      const updates: { family_name_kana?: string | null; given_name_kana?: string | null } = {};
      let needsUpdate = false;

      // family_name_kana の復号
      if (child.family_name_kana) {
        const decrypted = decryptPII(child.family_name_kana);
        if (decrypted !== null && decrypted !== child.family_name_kana) {
          // 復号成功 → 暗号化されていたデータ
          updates.family_name_kana = decrypted;
          needsUpdate = true;
        }
        // decrypted === null → 既に平文（復号失敗）、スキップ
      }

      // given_name_kana の復号
      if (child.given_name_kana) {
        const decrypted = decryptPII(child.given_name_kana);
        if (decrypted !== null && decrypted !== child.given_name_kana) {
          // 復号成功 → 暗号化されていたデータ
          updates.given_name_kana = decrypted;
          needsUpdate = true;
        }
        // decrypted === null → 既に平文（復号失敗）、スキップ
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('m_children')
          .update(updates)
          .eq('id', child.id);

        if (updateError) {
          console.error(`  Error updating child ${child.id}:`, updateError.message);
          totalErrors++;
        } else {
          totalUpdated++;
        }
      } else {
        totalSkipped++;
      }
    }

    offset += BATCH_SIZE;
  }

  console.log('');
  console.log('Migration completed!');
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped (already plaintext): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
