import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/companies/[companyId]/facilities/route';
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

jest.mock('@/lib/email/templates', () => ({
  buildUserInvitationEmailHtml: jest.fn().mockReturnValue('<html>invite</html>'),
}));

jest.mock('@/lib/utils/timezone', () => ({
  getCurrentDateJST: jest.fn().mockReturnValue('2024-01-01'),
}));

const createParams = (companyId: string) => ({
  params: Promise.resolve({ companyId }),
});

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/companies/company-1/facilities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const validBody = {
  facility: { name: 'テスト学童保育' },
  facility_admin: { name: '施設管理者太郎', email: 'facility@example.com' },
};

describe('POST /api/admin/companies/[companyId]/facilities', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;
  const mockedSendWithGas = sendWithGas as jest.MockedFunction<typeof sendWithGas>;

  let originalEnv: string | undefined;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedSendWithGas.mockResolvedValue(undefined);
    originalEnv = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    `${request.nextUrl.protocol}//${request.nextUrl.host}` = 'https://example.com';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    } else {
      `${request.nextUrl.protocol}//${request.nextUrl.host}` = originalEnv;
    }
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 403 when user is facility_admin', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Permission denied');
  });

  it('should return 403 when company_admin of different company', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'company_admin',
      company_id: 'other-company',
      current_facility_id: null,
    });

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Permission denied');
  });

  it('should allow company_admin of same company', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-existing',
      user_id: 'user-company-admin',
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    const facilityInsertQuery: any = {
      insert: jest.fn(() => facilityInsertQuery),
      select: jest.fn(() => facilityInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'facility-new', name: 'テスト学童保育' },
        error: null,
      }),
    };

    const userInsertQuery: any = {
      insert: jest.fn(() => userInsertQuery),
      select: jest.fn(() => userInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-new',
          name: '施設管理者太郎',
          email: 'facility@example.com',
          role: 'facility_admin',
        },
        error: null,
      }),
    };

    const userFacilityInsertQuery: any = {
      insert: jest.fn(() => userFacilityInsertQuery),
    };
    userFacilityInsertQuery.insert.mockResolvedValue({ error: null });

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return companyCheckQuery;
        if (fromCallCount === 2 && table === 'm_users') return emailCheckQuery;
        if (fromCallCount === 3 && table === 'm_facilities') return facilityInsertQuery;
        if (fromCallCount === 4 && table === 'm_users') return userInsertQuery;
        if (fromCallCount === 5 && table === '_user_facility') return userFacilityInsertQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-new' } },
            error: null,
          }),
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token_hash=test-token&type=invite',
              },
            },
            error: null,
          }),
          updateUserById: jest.fn().mockResolvedValue({ error: null }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it('should return 400 when required params missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const request = buildRequest({
      facility: {},
      facility_admin: { name: '管理者', email: 'a@b.com' },
    });

    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('facility.name');
  });

  it('should return 400 for invalid email format', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const request = buildRequest({
      facility: { name: 'テスト学童保育' },
      facility_admin: { name: '施設管理者太郎', email: 'invalid-email' },
    });

    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('メールアドレスの形式が正しくありません');
  });

  it('should return 400 when admin name exceeds 100 chars', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const longName = 'あ'.repeat(101);
    const request = buildRequest({
      facility: { name: 'テスト学童保育' },
      facility_admin: { name: longName, email: 'admin@example.com' },
    });

    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('管理者氏名は100文字以内で入力してください');
  });

  it('should return 404 when company not found', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Company not found' },
      }),
    };

    const mockSupabase = {
      from: jest.fn(() => companyCheckQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('non-existent-company'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Company not found');
  });

  it('should return 400 when email already exists', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'existing-user-id' },
        error: null,
      }),
    };

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return companyCheckQuery;
        if (fromCallCount === 2 && table === 'm_users') return emailCheckQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('このメールアドレスは既に使用されています');
  });

  it('should create facility and admin successfully', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    const facilityInsertQuery: any = {
      insert: jest.fn(() => facilityInsertQuery),
      select: jest.fn(() => facilityInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'facility-new', name: 'テスト学童保育' },
        error: null,
      }),
    };

    const userInsertQuery: any = {
      insert: jest.fn(() => userInsertQuery),
      select: jest.fn(() => userInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user-new',
          name: '施設管理者太郎',
          email: 'facility@example.com',
          role: 'facility_admin',
        },
        error: null,
      }),
    };

    const userFacilityInsertQuery: any = {
      insert: jest.fn(() => userFacilityInsertQuery),
    };
    userFacilityInsertQuery.insert.mockResolvedValue({ error: null });

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return companyCheckQuery;
        if (fromCallCount === 2 && table === 'm_users') return emailCheckQuery;
        if (fromCallCount === 3 && table === 'm_facilities') return facilityInsertQuery;
        if (fromCallCount === 4 && table === 'm_users') return userInsertQuery;
        if (fromCallCount === 5 && table === '_user_facility') return userFacilityInsertQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-new' } },
            error: null,
          }),
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

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.facility_id).toBe('facility-new');
    expect(json.data.facility_name).toBe('テスト学童保育');
    expect(json.data.facility_admin_id).toBe('user-new');
    expect(json.message).toContain('施設と施設管理者を作成しました');
    expect(mockedSendWithGas).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'facility@example.com',
        subject: '【のびレコ】アカウント登録のご案内',
      })
    );
  });

  it('should rollback on auth user creation failure', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'site_admin',
      company_id: null,
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      }),
    };

    const facilityInsertQuery: any = {
      insert: jest.fn(() => facilityInsertQuery),
      select: jest.fn(() => facilityInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'facility-new', name: 'テスト学童保育' },
        error: null,
      }),
    };

    const facilityDeleteQuery: any = {
      delete: jest.fn(() => facilityDeleteQuery),
      eq: jest.fn(() => facilityDeleteQuery),
    };
    facilityDeleteQuery.eq.mockResolvedValue({ error: null });

    let fromCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        fromCallCount++;
        if (fromCallCount === 1 && table === 'm_companies') return companyCheckQuery;
        if (fromCallCount === 2 && table === 'm_users') return emailCheckQuery;
        if (fromCallCount === 3 && table === 'm_facilities') return facilityInsertQuery;
        if (fromCallCount === 4 && table === 'm_facilities') return facilityDeleteQuery;
        throw new Error(`Unexpected table call ${fromCallCount}: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Auth user creation failed' },
          }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest(validBody);
    const response = await POST(request, createParams('company-1'));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Internal Server Error');
    expect(facilityDeleteQuery.eq).toHaveBeenCalledWith('id', 'facility-new');
  });
});
