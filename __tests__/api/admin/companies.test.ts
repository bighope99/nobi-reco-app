import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/companies/route';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/lib/email/gas', () => ({
  sendWithGas: jest.fn(),
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/admin/companies', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 403 when user is not site_admin', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Permission denied');
  });

  it('should return companies list when user is site_admin', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const mockCompanies = [
      {
        id: 'company-1',
        name: '株式会社テスト',
        name_kana: 'テスト',
        postal_code: '100-0001',
        address: '東京都千代田区',
        phone: '03-1234-5678',
        email: 'test@example.com',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'company-2',
        name: '株式会社サンプル',
        name_kana: 'サンプル',
        postal_code: '200-0002',
        address: '東京都新宿区',
        phone: '03-9876-5432',
        email: 'sample@example.com',
        is_active: true,
        created_at: '2024-02-01T00:00:00.000Z',
        updated_at: '2024-02-01T00:00:00.000Z',
      },
    ];

    const companiesQuery: any = {
      select: jest.fn(() => companiesQuery),
      is: jest.fn(() => companiesQuery),
      order: jest.fn(),
    };

    companiesQuery.order.mockResolvedValue({
      data: mockCompanies,
      error: null,
    });

    // Batch facility query (returns all facilities with company_id)
    const facilitiesQuery: any = {
      select: jest.fn(() => facilitiesQuery),
      in: jest.fn(() => facilitiesQuery),
      is: jest.fn(),
    };
    facilitiesQuery.is.mockResolvedValue({
      data: [
        { company_id: 'company-1' },
        { company_id: 'company-1' },
        { company_id: 'company-1' },
        { company_id: 'company-2' },
        { company_id: 'company-2' },
        { company_id: 'company-2' },
        { company_id: 'company-2' },
        { company_id: 'company-2' },
      ],
    });

    // Batch admin user query
    const adminUserQuery: any = {
      select: jest.fn(() => adminUserQuery),
      in: jest.fn(() => adminUserQuery),
      eq: jest.fn(() => adminUserQuery),
      is: jest.fn(),
    };
    adminUserQuery.is.mockResolvedValue({
      data: [],
    });

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companiesQuery;
        if (table === 'm_facilities') return facilitiesQuery;
        if (table === 'm_users') return adminUserQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.companies).toHaveLength(2);
    expect(json.data.total).toBe(2);
    expect(json.data.companies[0]).toMatchObject({
      id: 'company-1',
      name: '株式会社テスト',
      facilities_count: 3,
    });
    expect(json.data.companies[1]).toMatchObject({
      id: 'company-2',
      name: '株式会社サンプル',
      facilities_count: 5,
    });
  });

  it('should include facility count for each company', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const mockCompanies = [
      {
        id: 'company-1',
        name: '株式会社テスト',
        name_kana: 'テスト',
        postal_code: '100-0001',
        address: '東京都千代田区',
        phone: '03-1234-5678',
        email: 'test@example.com',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    const companiesQuery: any = {
      select: jest.fn(() => companiesQuery),
      is: jest.fn(() => companiesQuery),
      order: jest.fn(),
    };

    companiesQuery.order.mockResolvedValue({
      data: mockCompanies,
      error: null,
    });

    const facilitiesQuery: any = {
      select: jest.fn(() => facilitiesQuery),
      in: jest.fn(() => facilitiesQuery),
      is: jest.fn(),
    };
    facilitiesQuery.is.mockResolvedValue({
      data: [
        { company_id: 'company-1' },
        { company_id: 'company-1' },
      ],
    });

    const adminUserQuery: any = {
      select: jest.fn(() => adminUserQuery),
      in: jest.fn(() => adminUserQuery),
      eq: jest.fn(() => adminUserQuery),
      is: jest.fn(),
    };
    adminUserQuery.is.mockResolvedValue({
      data: [],
    });

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companiesQuery;
        if (table === 'm_facilities') return facilitiesQuery;
        if (table === 'm_users') return adminUserQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.companies[0].facilities_count).toBe(2);
    expect(facilitiesQuery.in).toHaveBeenCalledWith('company_id', ['company-1']);
    expect(facilitiesQuery.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('should return 500 when database error occurs', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companiesQuery: any = {
      select: jest.fn(() => companiesQuery),
      is: jest.fn(() => companiesQuery),
      order: jest.fn(() => companiesQuery),
    };

    companiesQuery.order.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const mockSupabase = {
      from: jest.fn(() => companiesQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Internal Server Error');
  });
});

describe('POST /api/admin/companies', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;
  const mockedSendWithGas = sendWithGas as jest.MockedFunction<typeof sendWithGas>;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedSendWithGas.mockResolvedValue(undefined);
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
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

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
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

    const request = buildRequest({
      company: {},
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('company.name');
  });

  it('should return 400 when admin_user name is missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('admin_user.name');
  });

  it('should return 400 when admin_user email is missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('admin_user.email');
  });

  it('should return 400 when email already exists', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const usersQuery: any = {
      select: jest.fn(() => usersQuery),
      eq: jest.fn(() => usersQuery),
      is: jest.fn(() => usersQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'existing-user-id' },
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn(() => usersQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎', email: 'existing@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Email already exists');
  });

  it('should create company and admin user (without facility)', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const usersCheckQuery: any = {
      select: jest.fn(() => usersCheckQuery),
      eq: jest.fn(() => usersCheckQuery),
      is: jest.fn(() => usersCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    const companyInsertQuery: any = {
      insert: jest.fn(() => companyInsertQuery),
      select: jest.fn(() => companyInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'company-new-1',
          name: 'テスト株式会社',
          is_active: true,
        },
        error: null,
      }),
    };

    const userInsertQuery: any = {
      insert: jest.fn(() => userInsertQuery),
      select: jest.fn(() => userInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-new-1',
          name: '管理者太郎',
          email: 'admin@example.com',
          role: 'company_admin',
          company_id: 'company-new-1',
        },
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users' && !companyInsertQuery.insert.mock.calls.length) return usersCheckQuery;
        if (table === 'm_companies') return companyInsertQuery;
        if (table === 'm_users') return userInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-new-1', email: 'admin@example.com' } },
            error: null,
          }),
          deleteUser: jest.fn().mockResolvedValue({ error: null }),
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token_hash=test-token&type=invite',
              },
            },
            error: null,
          }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.company_id).toBe('company-new-1');
    expect(json.data.company_name).toBe('テスト株式会社');
    expect(json.data.admin_user_id).toBe('user-new-1');
    // 施設は別ステップで登録するため、レスポンスに含まれない
    expect(json.data.facility_id).toBeUndefined();
    expect(json.message).toContain('会社と管理者ユーザーを作成しました');
    expect(mockedSendWithGas).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: '【のびレコ】アカウント登録のご案内',
      })
    );
  });

  it('should create company and admin user with company_admin current_facility_id as null', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const usersCheckQuery: any = {
      select: jest.fn(() => usersCheckQuery),
      eq: jest.fn(() => usersCheckQuery),
      is: jest.fn(() => usersCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    const companyInsertQuery: any = {
      insert: jest.fn(() => companyInsertQuery),
      select: jest.fn(() => companyInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'company-new-1',
          name: 'テスト株式会社',
        },
        error: null,
      }),
    };

    const userInsertQuery: any = {
      insert: jest.fn(() => userInsertQuery),
      select: jest.fn(() => userInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-new-1',
          name: '管理者太郎',
          email: 'admin@example.com',
          role: 'company_admin',
          company_id: 'company-new-1',
        },
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users' && !companyInsertQuery.insert.mock.calls.length) return usersCheckQuery;
        if (table === 'm_companies') return companyInsertQuery;
        if (table === 'm_users') return userInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const mockCreateUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-new-1', email: 'admin@example.com' } },
      error: null,
    });

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: mockCreateUser,
          deleteUser: jest.fn().mockResolvedValue({ error: null }),
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token_hash=test-token&type=invite',
              },
            },
            error: null,
          }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // company_admin の current_facility_id が null で作成されること
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          current_facility_id: null,
        }),
      })
    );
  });

  it('should return 500 when company creation fails', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const usersCheckQuery: any = {
      select: jest.fn(() => usersCheckQuery),
      eq: jest.fn(() => usersCheckQuery),
      is: jest.fn(() => usersCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    const companyInsertQuery: any = {
      insert: jest.fn(() => companyInsertQuery),
      select: jest.fn(() => companyInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Company creation failed' },
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return usersCheckQuery;
        if (table === 'm_companies') return companyInsertQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest({
      company: { name: 'テスト株式会社' },
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Internal Server Error');
  });
});
