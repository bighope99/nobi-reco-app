import { NextRequest } from 'next/server';
import { POST } from '@/app/api/facilities/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/facilities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/facilities', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('stores only schema-backed fields on facility creation', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const insertQuery: any = {
      insert: jest.fn(() => insertQuery),
      select: jest.fn(() => insertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'facility-1',
          name: 'ひまわり保育園',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_facilities') return insertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest({
      name: 'ひまわり保育園',
      address: '東京都渋谷区1-2-3',
      phone: '03-1234-5678',
      email: 'info@example.com',
      postal_code: '150-0001',
      capacity: 120,
      fax: '03-9999-9999',
      website: 'https://example.com',
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'company-1',
        name: 'ひまわり保育園',
        address: '東京都渋谷区1-2-3',
        phone: '03-1234-5678',
        email: 'info@example.com',
        postal_code: '150-0001',
        capacity: 120,
        is_active: true,
      })
    );
    const inserted = insertQuery.insert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty('fax');
    expect(inserted).not.toHaveProperty('website');
    expect(json.success).toBe(true);
  });
});
