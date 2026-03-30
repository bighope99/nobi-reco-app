import { GET } from '@/app/children/import/template/route';

describe('GET /children/import/template', () => {
  it('returns a new-record template without ID column', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const csv = await response.text();
    const [headerLine, sampleLine] = csv.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    expect(headerLine.startsWith('ID,')).toBe(false);
    expect(headerLine.split(',')[0]).toBe('姓');
    expect(headerLine).toContain('筆頭保護者_続柄');
    expect(headerLine).toContain('保護者連絡先1_氏名');
    expect(sampleLine.startsWith('sample-child-001,')).toBe(false);
    expect(sampleLine.split(',')[0]).toBe('山田');
  });
});
