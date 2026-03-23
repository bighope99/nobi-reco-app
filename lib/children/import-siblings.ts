import { normalizePhone } from '@/lib/children/import-csv';

export type IncomingSiblingRow = {
  row: number;
  child_name: string;
  parent_name: string;
  phone: string;
};

export type ExistingSiblingRow = {
  child_id: string;
  child_name: string;
  guardian_name: string;
  phone: string;
};

export type SiblingCandidateGroup = {
  phone_key: string;
  guardian_names: string[];
  children: Array<{
    source: 'existing' | 'import';
    name: string;
    row?: number;
    child_id?: string;
  }>;
};

export type RegisteredSiblingPair = {
  child_id: string;
  sibling_id: string;
};

export function buildSiblingCandidateGroups(
  incoming: IncomingSiblingRow[],
  existing: ExistingSiblingRow[],
  registeredPairs: RegisteredSiblingPair[] = [],
): SiblingCandidateGroup[] {
  const groupMap = new Map<
    string,
    {
      guardians: Map<string, true>;
      children: Map<string, { source: 'existing' | 'import'; name: string; row?: number; child_id?: string }>;
    }
  >();

  const ensureGroup = (phoneKey: string) => {
    const existingGroup = groupMap.get(phoneKey);
    if (existingGroup) return existingGroup;
    const nextGroup = { guardians: new Map(), children: new Map() };
    groupMap.set(phoneKey, nextGroup);
    return nextGroup;
  };

  incoming.forEach((row) => {
    const phoneKey = normalizePhone(row.phone);
    if (!phoneKey) return;
    const group = ensureGroup(phoneKey);
    if (row.parent_name) {
      group.guardians.set(row.parent_name, true);
    }
    const childKey = `import:${row.row}`;
    group.children.set(childKey, {
      source: 'import',
      name: row.child_name,
      row: row.row,
    });
  });

  existing.forEach((row) => {
    const phoneKey = normalizePhone(row.phone);
    if (!phoneKey) return;
    const group = ensureGroup(phoneKey);
    if (row.guardian_name) {
      group.guardians.set(row.guardian_name, true);
    }
    const childKey = `existing:${row.child_id}`;
    group.children.set(childKey, {
      source: 'existing',
      name: row.child_name,
      child_id: row.child_id,
    });
  });

  const registeredPairSet = new Set(
    registeredPairs.flatMap(({ child_id, sibling_id }) => [
      `${child_id}:${sibling_id}`,
      `${sibling_id}:${child_id}`,
    ]),
  );

  const isPairRegistered = (idA: string, idB: string): boolean =>
    registeredPairSet.has(`${idA}:${idB}`);

  return Array.from(groupMap.entries())
    .map(([phone_key, group]) => ({
      phone_key,
      guardian_names: Array.from(group.guardians.keys()),
      children: Array.from(group.children.values()),
    }))
    .filter((group) => group.children.length >= 2)
    .filter((group) => {
      // existing の child_id を持つ子のみ抽出
      const existingChildren = group.children.filter(
        (c) => c.source === 'existing' && c.child_id !== undefined,
      );

      // import の子が1人でもいれば必ず未登録ペアが存在する
      const hasImportChild = group.children.some((c) => c.source === 'import');
      if (hasImportChild) return true;

      // existing 同士の全ペアを列挙し、1つでも未登録があればグループを表示
      for (let i = 0; i < existingChildren.length; i++) {
        for (let j = i + 1; j < existingChildren.length; j++) {
          const idA = existingChildren[i].child_id!;
          const idB = existingChildren[j].child_id!;
          if (!isPairRegistered(idA, idB)) return true;
        }
      }

      // 全ペアが登録済みのためグループを除外
      return false;
    });
}
