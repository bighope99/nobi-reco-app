import { GET } from '@/app/api/children/export/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { CHILD_IMPORT_HEADERS } from '@/lib/children/import-csv';
import { NextRequest } from 'next/server';

const makeRequest = (url = 'http://localhost/api/children/export') =>
  new NextRequest(url);

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/crypto/decryption-helper', () => ({
  decryptOrFallback: (value: string | null | undefined) => value || null,
  decryptOrEmpty: (value: string | null | undefined) => value || '',
  formatName: (parts: Array<string | null | undefined>, emptyValue: string | null = null) => {
    const cleaned = parts
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(' ') : emptyValue;
  },
}));

/**
 * Supabaseモックビルダー
 * m_facilities: 施設名クエリ（maybeSingle で返す）
 * m_children: 児童一覧クエリ（order で返す）
 */
const buildMockSupabase = (options: {
  facilityData?: { id: string; name: string } | null;
  childrenData?: any[];
  childrenError?: any;
}) => {
  const {
    facilityData = { id: 'facility-1', name: 'テスト施設' },
    childrenData = [],
    childrenError = null,
  } = options;

  return {
    from: jest.fn((table: string) => {
      if (table === 'm_facilities') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: facilityData,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // m_children
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: childrenData,
                error: childrenError,
              }),
            }),
          }),
        }),
      };
    }),
  };
};

describe('GET /api/children/export', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('should return CSV with correct headers including ID column', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      childrenData: [
        {
          id: 'child-uuid-1',
          family_name: '山田',
          given_name: '花子',
          family_name_kana: 'ヤマダ',
          given_name_kana: 'ハナコ',
          nickname: null,
          gender: 'female',
          birth_date: '2019-04-12',
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          allergies: null,
          child_characteristics: null,
          parent_characteristics: null,
          photo_permission_public: true,
          photo_permission_share: true,
          _child_guardian: [
            {
              relationship: '保護者',
              is_primary: true,
              is_emergency_contact: true,
              m_guardians: {
                family_name: '山田',
                given_name: '太郎',
                phone: '09012345678',
                email: 'taro@example.com',
              },
            },
          ],
        },
      ],
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');

    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    // 一覧エクスポートは更新用なので ID 列を含む
    expect(lines[0]).toBe(CHILD_IMPORT_HEADERS.join(','));

    // Check data row starts with child UUID
    expect(lines[1].startsWith('child-uuid-1,')).toBe(true);

    expect(lines[0]).toContain('姓');
    expect(lines[0]).toContain('名');
    expect(lines[0]).toContain('生年月日');
    expect(lines[0]).toContain('保護者_続柄');
    expect(lines[0]).toContain('保護者連絡先1_氏名');

    const dataFields = lines[1].split(',');
    const parentRelationshipIndex = CHILD_IMPORT_HEADERS.indexOf('保護者_続柄');
    expect(dataFields[parentRelationshipIndex]).toBe('保護者');
  });

  it('should return JSON error when DB query fails', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      childrenError: { message: 'DB connection failed' },
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);

    // JSONエラーが返ること（CSVではなく）
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it('should output kana fields (セイ・メイ) as plaintext without decryption', async () => {
    // family_name_kana / given_name_kana は平文で保存されるため、
    // decryptOrEmpty を通さずそのまま出力される必要がある
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      childrenData: [
        {
          id: 'child-uuid-kana',
          family_name: 'encrypted-family',
          given_name: 'encrypted-given',
          // フリガナは平文で保存されている（暗号化されていない）
          family_name_kana: 'ヤマダ',
          given_name_kana: 'ハナコ',
          nickname: null,
          gender: 'female',
          birth_date: '2019-04-12',
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          allergies: null,
          child_characteristics: null,
          parent_characteristics: null,
          photo_permission_public: true,
          photo_permission_share: true,
          _child_guardian: [],
        },
      ],
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    const headers = lines[0].split(',');
    const seiIndex = headers.indexOf('セイ');
    const meiIndex = headers.indexOf('メイ');
    expect(seiIndex).toBeGreaterThan(-1);
    expect(meiIndex).toBeGreaterThan(-1);

    // 平文のフリガナがそのまま出力されること（decryptOrEmpty を通すと空文字になるバグの修正確認）
    const dataFields = lines[1].split(',');
    expect(dataFields[seiIndex]).toBe('ヤマダ');
    expect(dataFields[meiIndex]).toBe('ハナコ');
  });

  it('should include facility name and date in filename', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      facilityData: { id: 'facility-1', name: 'ひまわり学童' },
      childrenData: [],
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const contentDisposition = response.headers.get('Content-Disposition') || '';
    // YYYYMMDD_施設名.csv 形式であることを確認
    expect(contentDisposition).toMatch(/filename\*=UTF-8''/);
    const encodedFilename = contentDisposition.match(/filename\*=UTF-8''(.+)/)?.[1] || '';
    const filename = decodeURIComponent(encodedFilename);
    // 日付（8桁）_施設名.csv の形式
    expect(filename).toMatch(/^\d{8}_ひまわり学童\.csv$/);
  });

  it('should use fallback filename when facility name is empty', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      facilityData: null,
      childrenData: [],
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const encodedFilename = contentDisposition.match(/filename\*=UTF-8''(.+)/)?.[1] || '';
    const filename = decodeURIComponent(encodedFilename);
    // 施設名がない場合は YYYYMMDD_児童データ.csv
    expect(filename).toMatch(/^\d{8}_児童データ\.csv$/);
  });

  it('should return empty CSV when no children exist', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({ childrenData: [] });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    // Only header row, no data
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(CHILD_IMPORT_HEADERS.join(','));
  });

  it('should preserve leading zeros in phone numbers using double-quote wrapping', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      childrenData: [
        {
          id: 'child-phone-test',
          family_name: '田中',
          given_name: '一郎',
          family_name_kana: 'タナカ',
          given_name_kana: 'イチロウ',
          nickname: null,
          gender: 'male',
          birth_date: '2018-06-15',
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          allergies: null,
          child_characteristics: null,
          parent_characteristics: null,
          photo_permission_public: false,
          photo_permission_share: false,
          _child_guardian: [
            {
              relationship: '母',
              is_primary: true,
              is_emergency_contact: false,
              m_guardians: {
                family_name: '田中',
                given_name: '花子',
                phone: '09012345678',
                email: 'hanako@example.com',
              },
            },
            {
              relationship: '父',
              is_primary: false,
              is_emergency_contact: true,
              m_guardians: {
                family_name: '田中',
                given_name: '太郎',
                phone: '08087654321',
                email: null,
              },
            },
          ],
        },
      ],
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    const headers = lines[0].split(',');
    const parentPhoneIndex = headers.indexOf('保護者電話');
    const ec1PhoneIndex = headers.indexOf('保護者連絡先1_電話');

    expect(parentPhoneIndex).toBeGreaterThan(-1);
    expect(ec1PhoneIndex).toBeGreaterThan(-1);

    // ダブルクォートで囲まれて出力されること（先頭0を保持）
    const dataFields = lines[1].split(',');
    expect(dataFields[parentPhoneIndex]).toBe('"09012345678"');
    expect(dataFields[ec1PhoneIndex]).toBe('"08087654321"');
  });

  it('should output empty string for empty phone numbers', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockSupabase = buildMockSupabase({
      childrenData: [
        {
          id: 'child-no-phone',
          family_name: '佐藤',
          given_name: '次郎',
          family_name_kana: 'サトウ',
          given_name_kana: 'ジロウ',
          nickname: null,
          gender: 'male',
          birth_date: '2019-01-01',
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          allergies: null,
          child_characteristics: null,
          parent_characteristics: null,
          photo_permission_public: false,
          photo_permission_share: false,
          _child_guardian: [],
        },
      ],
    });

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    const headers = lines[0].split(',');
    const parentPhoneIndex = headers.indexOf('保護者電話');
    const ec1PhoneIndex = headers.indexOf('保護者連絡先1_電話');
    const ec2PhoneIndex = headers.indexOf('保護者連絡先2_電話');

    // 電話番号が空の場合は空文字
    const dataFields = lines[1].split(',');
    expect(dataFields[parentPhoneIndex]).toBe('');
    expect(dataFields[ec1PhoneIndex]).toBe('');
    expect(dataFields[ec2PhoneIndex]).toBe('');
  });
});
