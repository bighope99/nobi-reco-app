import { GET } from '@/app/api/children/export/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
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
  formatName: (parts: Array<string | null | undefined>, emptyValue: string | null = null) => {
    const cleaned = parts
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(' ') : emptyValue;
  },
}));

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

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockIs = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockResolvedValue({
      data: [
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
      error: null,
    });

    const mockSupabase = {
      from: jest.fn(() => ({
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        order: mockOrder,
      })),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');

    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    // Check header starts with ID
    expect(lines[0].startsWith('ID,')).toBe(true);

    // Check data row starts with child UUID
    expect(lines[1].startsWith('child-uuid-1,')).toBe(true);

    // Check header contains expected columns
    expect(lines[0]).toContain('姓');
    expect(lines[0]).toContain('名');
    expect(lines[0]).toContain('生年月日');
  });

  it('should return JSON error when DB query fails', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockOrder = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    });

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: mockOrder,
      })),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);

    // JSONエラーが返ること（CSVではなく）
    const json = await response.json();
    expect(json.success).toBe(false);
  });

  it('should return empty CSV when no children exist', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      current_facility_id: 'facility-1',
      company_id: 'company-1',
    });

    const mockOrder = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: mockOrder,
      })),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const text = await response.text();
    const lines = text.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);

    // Only header row, no data
    expect(lines.length).toBe(1);
    expect(lines[0].startsWith('ID,')).toBe(true);
  });
});
