import { buildSiblingCandidateGroups } from '@/lib/children/import-siblings';
import { normalizePhone } from '@/lib/children/import-csv';

describe('import sibling candidates', () => {
  it('normalizes phone by removing hyphens and spaces', () => {
    expect(normalizePhone('090-1234 5678')).toBe('09012345678');
    expect(normalizePhone('０９０ー１２３４－５６７８')).toBe('09012345678');
  });

  it('builds sibling candidate groups from incoming and existing rows', () => {
    const incoming = [
      { row: 2, child_name: '山田 花子', parent_name: '山田 太郎', phone: '090-1234-5678' },
      { row: 3, child_name: '山田 次郎', parent_name: '山田 太郎', phone: '09012345678' },
    ];
    const existing = [
      {
        child_id: 'child-1',
        child_name: '山田 一郎',
        guardian_name: '山田 太郎',
        phone: '090 1234 5678',
      },
    ];

    const groups = buildSiblingCandidateGroups(incoming, existing);

    expect(groups).toHaveLength(1);
    expect(groups[0].guardian_names).toContain('山田 太郎');
    expect(groups[0].children.length).toBe(3);
  });
});
