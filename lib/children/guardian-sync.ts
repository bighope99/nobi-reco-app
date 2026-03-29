import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 指定した子どもの保護者を全兄弟姉妹に同期する
 * 既存のリンクは保持し、新規リンクのみ追加する（is_primary は上書きしない）
 */
export async function syncGuardiansToSiblings(
  supabase: SupabaseClient,
  childId: string
): Promise<void> {
  // 兄弟を取得
  const { data: siblingLinks } = await supabase
    .from('_child_sibling')
    .select('sibling_id')
    .eq('child_id', childId);

  if (!siblingLinks || siblingLinks.length === 0) return;

  const siblingIds = siblingLinks.map((s: { sibling_id: string }) => s.sibling_id);

  // この子どもに紐づく保護者を取得
  const { data: childGuardians } = await supabase
    .from('_child_guardian')
    .select('guardian_id, relationship, is_emergency_contact')
    .eq('child_id', childId);

  if (!childGuardians || childGuardians.length === 0) return;

  // 各兄弟に保護者リンクを追加（既存は保持）
  for (const siblingId of siblingIds) {
    // 兄弟の既存リンクを取得
    const { data: existingLinks } = await supabase
      .from('_child_guardian')
      .select('guardian_id')
      .eq('child_id', siblingId);

    const existingGuardianIds = new Set(
      (existingLinks || []).map((l: { guardian_id: string }) => l.guardian_id)
    );

    // 新規リンクのみ追加
    const newLinks = childGuardians
      .filter((g: { guardian_id: string }) => !existingGuardianIds.has(g.guardian_id))
      .map((g: { guardian_id: string; relationship: string; is_emergency_contact: boolean }) => ({
        child_id: siblingId,
        guardian_id: g.guardian_id,
        relationship: g.relationship,
        is_primary: false,
        is_emergency_contact: g.is_emergency_contact,
      }));

    if (newLinks.length > 0) {
      const { error } = await supabase.from('_child_guardian').insert(newLinks);
      if (error) {
        console.error('Guardian sync to sibling error:', error.message);
      }
    }
  }
}

/**
 * 2人の子ども間で保護者を双方向に同期する
 * 既存のリンクは保持し、新規リンクのみ追加する
 * ※ _child_sibling への挿入後に呼び出すこと
 */
export async function syncGuardiansBidirectional(
  supabase: SupabaseClient,
  childIdA: string,
  childIdB: string
): Promise<void> {
  await Promise.all([
    syncGuardiansToSiblings(supabase, childIdA),
    syncGuardiansToSiblings(supabase, childIdB),
  ]);
}
