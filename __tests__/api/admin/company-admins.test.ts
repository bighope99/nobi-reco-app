import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/company-admins/route';
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
  new NextRequest('http://localhost/api/admin/company-admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/admin/company-admins', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;
  const mockedSendWithGas = sendWithGas as jest.MockedFunction<typeof sendWithGas>;

  beforeEach(() => {
    jest.resetAllMocks();
    mockedSendWithGas.mockResolvedValue({ ok: true });
  });

  it('should return 401 when user is not authenticated', async () => {
    mockedGetMetadata.mockResolvedValue(null);

    const request = buildRequest({
      company_id: 'company-1',
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
      user_id: 'test-user-id',
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Permission denied');
  });

  it('should return 400 when company_id is missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const request = buildRequest({
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('company_id');
  });

  it('should return 400 when admin_user.name is missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('admin_user.name');
  });

  it('should return 400 when admin_user.email is missing', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('admin_user.email');
  });

  it('should return 400 for invalid email format', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'invalid-email' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('メールアドレスの形式が正しくない');
  });

  it('should return 400 when admin name exceeds 100 chars', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const longName = 'あ'.repeat(101);
    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: longName, email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('100文字以内');
  });

  it('should return 404 when company not found', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn(() => companyCheckQuery),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest({
      company_id: 'nonexistent-company',
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Company not found');
  });

  it('should return 400 when email already exists', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'existing-user-id' },
        error: null,
      }),
    };

    let queryCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companyCheckQuery;
        if (table === 'm_users') {
          queryCallCount++;
          return emailCheckQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    // existingUser が存在する場合、supabaseAdmin.auth.admin.getUserById が呼ばれる
    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: {
              user: { id: 'existing-user-id', user_metadata: { password_set: true } },
            },
            error: null,
          }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'existing@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Email already exists');
  });

  it('should reinvite unsigned-in user and return 200', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'existing-user-id' },
        error: null,
      }),
    };

    const userUpdateQuery: any = {
      update: jest.fn(() => userUpdateQuery),
      eq: jest.fn(() => userUpdateQuery),
      select: jest.fn(() => userUpdateQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'existing-user-id',
          name: '管理者太郎',
          email: 'uninvited@example.com',
          role: 'company_admin',
          company_id: 'company-1',
        },
        error: null,
      }),
    };

    let userQueryCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companyCheckQuery;
        if (table === 'm_users') {
          userQueryCallCount++;
          // 1回目: emailCheckQuery (メール重複チェック), 2回目: userUpdateQuery (更新)
          if (userQueryCallCount === 1) return emailCheckQuery;
          return userUpdateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: {
              user: { id: 'existing-user-id', user_metadata: { password_set: false } },
            },
            error: null,
          }),
          updateUserById: jest.fn().mockResolvedValue({
            data: { user: { id: 'existing-user-id' } },
            error: null,
          }),
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token_hash=reinvite-token&type=invite',
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
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'uninvited@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toBe('招待メールを再送しました');
  });

  it('should return 400 when signed-in user tries to re-register', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'signed-in-user-id' },
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companyCheckQuery;
        if (table === 'm_users') return emailCheckQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    // password_set: true → パスワード設定済みユーザー
    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: {
              user: { id: 'signed-in-user-id', user_metadata: { password_set: true } },
            },
            error: null,
          }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'signedin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Email already exists');
  });

  it('should update name and company_id in m_users when reinviting', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'company-2', name: '別の会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'existing-user-id' },
        error: null,
      }),
    };

    const mockUpdate = jest.fn(() => userUpdateQuery);
    const userUpdateQuery: any = {
      update: mockUpdate,
      eq: jest.fn(() => userUpdateQuery),
      select: jest.fn(() => userUpdateQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'existing-user-id',
          name: '新しい管理者',
          email: 'reinvite@example.com',
          role: 'company_admin',
          company_id: 'company-2',
        },
        error: null,
      }),
    };

    let userQueryCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companyCheckQuery;
        if (table === 'm_users') {
          userQueryCallCount++;
          if (userQueryCallCount === 1) return emailCheckQuery;
          return userUpdateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: {
              user: { id: 'existing-user-id', user_metadata: { password_set: false } },
            },
            error: null,
          }),
          updateUserById: jest.fn().mockResolvedValue({
            data: { user: { id: 'existing-user-id' } },
            error: null,
          }),
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: 'https://test.supabase.co/auth/v1/verify?token_hash=reinvite-token&type=invite',
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
      company_id: 'company-2',
      admin_user: { name: '新しい管理者', email: 'reinvite@example.com' },
    });

    await POST(request);

    // m_users の update が呼ばれていること
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '新しい管理者',
        company_id: 'company-2',
      })
    );
  });

  it('should create company admin successfully', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const userInsertQuery: any = {
      insert: jest.fn(() => userInsertQuery),
      select: jest.fn(() => userInsertQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          name: '管理者太郎',
          email: 'admin@example.com',
          role: 'company_admin',
          company_id: 'company-1',
        },
        error: null,
      }),
    };

    let userQueryCallCount = 0;
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companyCheckQuery;
        if (table === 'm_users') {
          userQueryCallCount++;
          if (userQueryCallCount === 1) return emailCheckQuery;
          return userInsertQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-1' } },
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

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.company_id).toBe('company-1');
    expect(json.data.company_name).toBe('テスト会社');
    expect(json.data.admin_user_id).toBe('user-1');
    expect(json.message).toBe('会社管理者を登録しました');

    // Verify sendWithGas was called
    expect(mockedSendWithGas).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: '【のびレコ】アカウント登録のご案内',
      })
    );

    // Verify auth user was created with correct metadata
    expect(mockAdminClient.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@example.com',
        app_metadata: expect.objectContaining({
          role: 'company_admin',
          company_id: 'company-1',
          current_facility_id: null,
        }),
      })
    );
  });

  it('should return 500 when auth user creation fails', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'site_admin',
      company_id: 'test-company-id',
      current_facility_id: null,
    });

    const companyCheckQuery: any = {
      select: jest.fn(() => companyCheckQuery),
      eq: jest.fn(() => companyCheckQuery),
      is: jest.fn(() => companyCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'company-1', name: 'テスト会社' },
        error: null,
      }),
    };

    const emailCheckQuery: any = {
      select: jest.fn(() => emailCheckQuery),
      eq: jest.fn(() => emailCheckQuery),
      is: jest.fn(() => emailCheckQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_companies') return companyCheckQuery;
        if (table === 'm_users') return emailCheckQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const mockAdminClient = {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Auth user creation failed' },
          }),
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);

    const request = buildRequest({
      company_id: 'company-1',
      admin_user: { name: '管理者太郎', email: 'admin@example.com' },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Internal Server Error');
  });
});
