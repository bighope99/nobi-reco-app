import {
  buildChildPayload,
  normalizeEnrollmentStatus,
  normalizeGender,
  parseCsvText,
} from '@/lib/children/import-csv';

describe('children import csv helpers', () => {
  it('parses CSV with BOM and headers', () => {
    const csv = '\ufeff姓,名,生年月日,入所日\n山田,花子,2019-04-12,2024-04-01';
    const { headers, rows } = parseCsvText(csv);

    expect(headers).toEqual(['姓', '名', '生年月日', '入所日']);
    expect(rows[0]['姓']).toBe('山田');
    expect(rows[0]['名']).toBe('花子');
  });

  it('normalizes gender variations', () => {
    expect(normalizeGender('female')).toBe('female');
    expect(normalizeGender('女')).toBe('female');
    expect(normalizeGender('M')).toBe('male');
  });

  it('defaults enrollment status to enrolled', () => {
    expect(normalizeEnrollmentStatus('')).toBe('enrolled');
    expect(normalizeEnrollmentStatus('在籍')).toBe('enrolled');
  });

  it('builds payload with defaults and required checks', () => {
    const row = {
      姓: '山田',
      名: '花子',
      生年月日: '2019-04-12',
      入所日: '2024-04-01',
      性別: '女',
      保護者氏名: '山田 太郎',
      保護者電話: '090-1234-5678',
    };

    const result = buildChildPayload(row, { school_id: 'school-1', class_id: 'class-1' });

    expect(result.errors).toHaveLength(0);
    expect(result.payload?.basic_info?.school_id).toBe('school-1');
    expect(result.payload?.affiliation?.class_id).toBe('class-1');
    expect(result.payload?.basic_info?.gender).toBe('female');
    expect(result.payload?.affiliation?.enrollment_status).toBe('enrolled');
    expect(result.payload?.contact?.parent_phone).toBe('09012345678');
  });

  it('normalizes phone numbers with full-width separators', () => {
    const row = {
      姓: '山田',
      名: '花子',
      生年月日: '2019-04-12',
      入所日: '2024-04-01',
      性別: '女',
      保護者氏名: '山田 太郎',
      保護者電話: '０９０ー１２３４－５６７８',
    };

    const result = buildChildPayload(row, { school_id: null, class_id: null });

    expect(result.payload?.contact?.parent_phone).toBe('09012345678');
  });
});
