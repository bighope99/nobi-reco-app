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

export function buildSiblingCandidateGroups(
  incoming: IncomingSiblingRow[],
  existing: ExistingSiblingRow[]
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

  return Array.from(groupMap.entries())
    .map(([phone_key, group]) => ({
      phone_key,
      guardian_names: Array.from(group.guardians.keys()),
      children: Array.from(group.children.values()),
    }))
    .filter((group) => group.children.length >= 2);
}
