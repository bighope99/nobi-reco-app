import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 指定した子どもの保護者を兄弟姉妹に同期する
 * 既存のリンクは保持し、新規リンクのみ追加する。その後 is_primary を強制同期する
 *
 * @param supabase         Supabase クライアント（RLS 有効）
 * @param childId          起点となる子どもの ID
 * @param facilityId       施設 ID（クロステナントアクセスを防ぐ二重防御）
 * @param targetSiblingId  省略時は全兄弟姉妹に同期。指定時は対象の兄弟のみに同期
 */
export async function syncGuardiansToSiblings(
  supabase: SupabaseClient,
  childId: string,
  facilityId: string,
  targetSiblingId?: string
): Promise<void> {
  let validSiblingIds: string[];

  if (targetSiblingId) {
    // 対象の兄弟が同じ施設に属し削除されていないことを検証
    const { data: validSibling } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', targetSiblingId)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .single();
    if (!validSibling) return;
    validSiblingIds = [targetSiblingId];
  } else {
    // 兄弟を取得
    const { data: siblingLinks, error: siblingError } = await supabase
      .from('_child_sibling')
      .select('sibling_id')
      .eq('child_id', childId);

    if (siblingError) {
      throw new Error(`Failed to fetch sibling links for child ${childId}: ${siblingError.message}`);
    }
    if (!siblingLinks || siblingLinks.length === 0) return;

    const siblingIds = siblingLinks.map((s: { sibling_id: string }) => s.sibling_id);

    // 施設スコープを明示的に検証（RLS に依存しない二重防御）
    const { data: validSiblings, error: validationError } = await supabase
      .from('m_children')
      .select('id')
      .in('id', siblingIds)
      .eq('facility_id', facilityId)
      .is('deleted_at', null);

    if (validationError) {
      throw new Error(`Failed to validate sibling facility scope: ${validationError.message}`);
    }
    if (!validSiblings || validSiblings.length === 0) return;

    validSiblingIds = validSiblings.map((s: { id: string }) => s.id);
  }

  // この子どもに紐づく保護者を取得
  const { data: childGuardians, error: guardianError } = await supabase
    .from('_child_guardian')
    .select('guardian_id, relationship, is_emergency_contact, is_primary')
    .eq('child_id', childId);

  if (guardianError) {
    throw new Error(`Failed to fetch guardians for child ${childId}: ${guardianError.message}`);
  }
  if (!childGuardians || childGuardians.length === 0) return;

  // 全兄弟の既存リンクを一括取得（N+1 クエリを防ぐ）
  const { data: allExistingLinks, error: existingError } = await supabase
    .from('_child_guardian')
    .select('child_id, guardian_id')
    .in('child_id', validSiblingIds);

  if (existingError) {
    throw new Error(`Failed to fetch existing guardian links: ${existingError.message}`);
  }

  // sibling_id => Set<guardian_id> のマップを構築
  const existingMap = new Map<string, Set<string>>();
  for (const link of allExistingLinks || []) {
    const entry = existingMap.get(link.child_id);
    if (entry) {
      entry.add(link.guardian_id);
    } else {
      existingMap.set(link.child_id, new Set([link.guardian_id]));
    }
  }

  // 全兄弟の新規リンクを一括構築
  const newLinks = validSiblingIds.flatMap((siblingId: string) => {
    const existing = existingMap.get(siblingId) ?? new Set<string>();
    return childGuardians
      .filter((g: { guardian_id: string }) => !existing.has(g.guardian_id))
      .map((g: { guardian_id: string; relationship: string; is_emergency_contact: boolean; is_primary: boolean }) => ({
        child_id: siblingId,
        guardian_id: g.guardian_id,
        relationship: g.relationship,
        is_primary: g.is_primary,
        is_emergency_contact: g.is_emergency_contact,
      }));
  });

  if (newLinks.length === 0) return;

  // upsert で競合（unique constraint）を安全に処理
  const { error: upsertError } = await supabase
    .from('_child_guardian')
    .upsert(newLinks, { onConflict: 'child_id,guardian_id', ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`Failed to sync guardian links to siblings: ${upsertError.message}`);
  }

  // is_primary 同期: ソースの筆頭保護者をターゲット兄弟にも反映
  // ignoreDuplicates: true のため既存リンクは upsert では更新されないので別途 UPDATE する
  const primaryGuardianId = childGuardians.find(
    (g: { is_primary: boolean }) => g.is_primary
  )?.guardian_id;

  if (primaryGuardianId) {
    for (const siblingId of validSiblingIds) {
      // 筆頭保護者を is_primary=true に更新
      const { error: primaryUpdateError } = await supabase
        .from('_child_guardian')
        .update({ is_primary: true })
        .eq('child_id', siblingId)
        .eq('guardian_id', primaryGuardianId);

      if (primaryUpdateError) {
        throw new Error(`Failed to sync primary guardian for sibling ${siblingId}: ${primaryUpdateError.message}`);
      }

      // 他の保護者を is_primary=false に更新
      const { error: otherUpdateError } = await supabase
        .from('_child_guardian')
        .update({ is_primary: false })
        .eq('child_id', siblingId)
        .neq('guardian_id', primaryGuardianId);

      if (otherUpdateError) {
        throw new Error(`Failed to clear primary guardian for sibling ${siblingId}: ${otherUpdateError.message}`);
      }
    }
  }
}

/**
 * 2人の子ども間で保護者を双方向に同期する
 * 既存のリンクは保持し、新規リンクのみ追加する
 * ※ _child_sibling への挿入後に呼び出すこと
 *
 * @param supabase   Supabase クライアント（RLS 有効）
 * @param childIdA   子ども A の ID
 * @param childIdB   子ども B の ID
 * @param facilityId 施設 ID（クロステナントアクセスを防ぐ二重防御）
 */
export async function syncGuardiansBidirectional(
  supabase: SupabaseClient,
  childIdA: string,
  childIdB: string,
  facilityId: string
): Promise<void> {
  // targetSiblingId を指定してカスケード伝播を防ぐ（A→B のみ、B→A のみに限定）
  await syncGuardiansToSiblings(supabase, childIdA, facilityId, childIdB);
  await syncGuardiansToSiblings(supabase, childIdB, facilityId, childIdA);
}
