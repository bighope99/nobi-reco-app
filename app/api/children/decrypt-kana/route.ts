/**
 * カナ一括復号API（開発用・マージ前に削除）
 *
 * 施設の全児童の暗号化されたカナを復号して平文で保存し直す
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptPII } from '@/utils/crypto/piiEncryption';

const BATCH_SIZE = 100;

export async function POST() {
  const supabase = await createClient();
  const userMetadata = await getAuthenticatedUserMetadata(supabase);

  if (!userMetadata) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const facilityId = userMetadata.facility_id;
  if (!facilityId) {
    return NextResponse.json({ error: 'Facility ID not found' }, { status: 400 });
  }

  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    // バッチ取得
    const { data: children, error } = await supabase
      .from('m_children')
      .select('id, family_name_kana, given_name_kana')
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch children: ${error.message}` },
        { status: 500 }
      );
    }

    if (!children || children.length === 0) {
      break;
    }

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
      }

      // given_name_kana の復号
      if (child.given_name_kana) {
        const decrypted = decryptPII(child.given_name_kana);
        if (decrypted !== null && decrypted !== child.given_name_kana) {
          // 復号成功 → 暗号化されていたデータ
          updates.given_name_kana = decrypted;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('m_children')
          .update(updates)
          .eq('id', child.id);

        if (updateError) {
          console.error(`Error updating child ${child.id}:`, updateError.message);
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

  return NextResponse.json({
    success: true,
    data: {
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: totalErrors,
    },
  });
}
