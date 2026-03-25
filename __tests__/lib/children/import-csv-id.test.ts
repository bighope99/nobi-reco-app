import { buildChildPayload, parseCsvText } from '@/lib/children/import-csv';

describe('import-csv: ID column support', () => {
  describe('parseCsvText', () => {
    it('should parse CSV with ID column', () => {
      const csv = 'ID,姓,名,セイ,メイ,ニックネーム,性別,生年月日,入所状況,入所種別,入所日,退所日,保護者氏名,保護者電話,保護者メール\n' +
        'abc-123,山田,花子,ヤマダ,ハナコ,,女,2019-04-12,在籍,通年,2024-04-01,,山田太郎,09012345678,test@example.com\n';

      const { headers, rows } = parseCsvText(csv);
      expect(headers).toContain('ID');
      expect(rows[0]['ID']).toBe('abc-123');
      expect(rows[0]['姓']).toBe('山田');
    });

    it('should handle empty ID column', () => {
      const csv = 'ID,姓,名,セイ,メイ,ニックネーム,性別,生年月日,入所状況,入所種別,入所日,退所日,保護者氏名,保護者電話,保護者メール\n' +
        ',山田,花子,ヤマダ,ハナコ,,女,2019-04-12,在籍,通年,2024-04-01,,山田太郎,09012345678,test@example.com\n';

      const { rows } = parseCsvText(csv);
      expect(rows[0]['ID']).toBe('');
    });
  });

  describe('buildChildPayload', () => {
    const defaults = { school_id: null, class_id: null };

    it('should include child_id when ID is present in CSV row', () => {
      const row = {
        'ID': 'uuid-123',
        '姓': '山田',
        '名': '花子',
        'セイ': 'ヤマダ',
        'メイ': 'ハナコ',
        '性別': '女',
        '生年月日': '2019-04-12',
        '入所日': '2024-04-01',
        '保護者氏名': '山田太郎',
        '保護者電話': '090-1234-5678',
      };

      const { payload, errors } = buildChildPayload(row, defaults);
      expect(errors).toEqual([]);
      expect(payload?.child_id).toBe('uuid-123');
    });

    it('should have undefined child_id when ID is empty', () => {
      const row = {
        'ID': '',
        '姓': '山田',
        '名': '花子',
        'セイ': 'ヤマダ',
        'メイ': 'ハナコ',
        '性別': '女',
        '生年月日': '2019-04-12',
        '入所日': '2024-04-01',
        '保護者氏名': '山田太郎',
        '保護者電話': '090-1234-5678',
      };

      const { payload, errors } = buildChildPayload(row, defaults);
      expect(errors).toEqual([]);
      expect(payload?.child_id).toBeUndefined();
    });

    it('should have undefined child_id when ID column is missing', () => {
      const row = {
        '姓': '山田',
        '名': '花子',
        'セイ': 'ヤマダ',
        'メイ': 'ハナコ',
        '性別': '女',
        '生年月日': '2019-04-12',
        '入所日': '2024-04-01',
        '保護者氏名': '山田太郎',
        '保護者電話': '090-1234-5678',
      };

      const { payload, errors } = buildChildPayload(row, defaults);
      expect(errors).toEqual([]);
      expect(payload?.child_id).toBeUndefined();
    });
  });
});
