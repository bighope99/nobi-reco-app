import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/admin/companies/[companyId]/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

const createParams = (companyId: string) => ({
  params: Promise.resolve({ companyId }),
});

const buildPutRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/companies/company-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/admin/companies/[companyId]', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/admin/companies/company-1');
    const response = await GET(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 403 when user is not site_admin', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const request = new NextRequest('http://localhost/api/admin/companies/company-1');
    const response = await GET(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Permission denied');
  });

  it('should return 404 when company not found', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyQuery: any = {
      select: jest.fn(() => companyQuery),
      eq: jest.fn(() => companyQuery),
      is: jest.fn(() => companyQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }),
    };

    const mockSupabase = {
      from: jest.fn(() => companyQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost/api/admin/companies/company-1');
    const response = await GET(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Company not found');
  });

  it('should return company details with facilities and accounts', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyQuery: any = {
      select: jest.fn(() => companyQuery),
      eq: jest.fn(() => companyQuery),
      is: jest.fn(() => companyQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'company-1',
          name: '株式会社テスト',
          name_kana: 'テスト',
          postal_code: '100-0001',
          address: '東京都',
          phone: '03-1234',
          email: 'test@co.jp',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      }),
    };

    const facilitiesQuery: any = {
      select: jest.fn(() => facilitiesQuery),
      eq: jest.fn(() => facilitiesQuery),
      is: jest.fn(() => facilitiesQuery),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'facility-1',
            name: '施設A',
            name_kana: null,
            postal_code: null,
            address: null,
            phone: null,
            capacity: 30,
            is_active: true,
          },
        ],
        error: null,
      }),
    };

    const accountsQuery: any = {
      select: jest.fn(() => accountsQuery),
      eq: jest.fn(() => accountsQuery),
      in: jest.fn(() => accountsQuery),
      is: jest.fn(() => accountsQuery),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'user-1',
            name: '管理者',
            name_kana: null,
            email: 'admin@co.jp',
            role: 'company_admin',
            is_active: true,
            _user_facility: [
              {
                facility_id: 'facility-1',
                is_primary: true,
                m_facilities: { id: 'facility-1', name: '施設A' },
              },
            ],
          },
        ],
        error: null,
      }),
    };

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return companyQuery;
        if (fromCallCount === 2 && table === 'm_facilities') return facilitiesQuery;
        if (fromCallCount === 3 && table === 'm_users') return accountsQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost/api/admin/companies/company-1');
    const response = await GET(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.company.id).toBe('company-1');
    expect(json.data.company.name).toBe('株式会社テスト');
    expect(json.data.facilities).toHaveLength(1);
    expect(json.data.facilities[0].name).toBe('施設A');
    expect(json.data.accounts).toHaveLength(1);
    expect(json.data.accounts[0].facilities[0].facility_name).toBe('施設A');
  });

  it('should return 500 when database error occurs', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyQuery: any = {
      select: jest.fn(() => companyQuery),
      eq: jest.fn(() => companyQuery),
      is: jest.fn(() => companyQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'DATABASE_ERROR', message: 'Database connection failed' },
      }),
    };

    const mockSupabase = {
      from: jest.fn(() => companyQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost/api/admin/companies/company-1');
    const response = await GET(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Internal Server Error');
  });
});

describe('PUT /api/admin/companies/[companyId]', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const request = buildPutRequest({
      company: { name: '株式会社テスト' },
    });

    const response = await PUT(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 403 when user is not site_admin', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const request = buildPutRequest({
      company: { name: '株式会社テスト' },
    });

    const response = await PUT(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Permission denied');
  });

  it('should return 400 when company name is missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const request = buildPutRequest({
      company: {},
    });

    const response = await PUT(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('company.name');
  });

  it('should return 404 when company not found', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const existenceCheckQuery: any = {
      select: jest.fn(() => existenceCheckQuery),
      eq: jest.fn(() => existenceCheckQuery),
      is: jest.fn(() => existenceCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      }),
    };

    const mockSupabase = {
      from: jest.fn(() => existenceCheckQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildPutRequest({
      company: { name: '株式会社テスト' },
    });

    const response = await PUT(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Company not found');
  });

  it('should update company successfully', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const existenceCheckQuery: any = {
      select: jest.fn(() => existenceCheckQuery),
      eq: jest.fn(() => existenceCheckQuery),
      is: jest.fn(() => existenceCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'company-1' },
        error: null,
      }),
    };

    const updateQuery: any = {
      update: jest.fn(() => updateQuery),
      eq: jest.fn(() => updateQuery),
      select: jest.fn(() => updateQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'company-1',
          name: '株式会社テスト更新',
          name_kana: 'テストコウシン',
          postal_code: '100-0002',
          address: '東京都更新',
          phone: '03-5678',
          email: 'updated@co.jp',
        },
        error: null,
      }),
    };

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return existenceCheckQuery;
        if (fromCallCount === 2 && table === 'm_companies') return updateQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildPutRequest({
      company: {
        name: '株式会社テスト更新',
        name_kana: 'テストコウシン',
        postal_code: '100-0002',
        address: '東京都更新',
        phone: '03-5678',
        email: 'updated@co.jp',
      },
    });

    const response = await PUT(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.company.name).toBe('株式会社テスト更新');
    expect(json.message).toContain('会社情報を更新しました');
  });

  it('should return 500 when update fails', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const existenceCheckQuery: any = {
      select: jest.fn(() => existenceCheckQuery),
      eq: jest.fn(() => existenceCheckQuery),
      is: jest.fn(() => existenceCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'company-1' },
        error: null,
      }),
    };

    const updateQuery: any = {
      update: jest.fn(() => updateQuery),
      eq: jest.fn(() => updateQuery),
      select: jest.fn(() => updateQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      }),
    };

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return existenceCheckQuery;
        if (fromCallCount === 2 && table === 'm_companies') return updateQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildPutRequest({
      company: { name: '株式会社テスト' },
    });

    const response = await PUT(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Internal Server Error');
  });
});
