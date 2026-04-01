import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/users/route';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/lib/email/gas', () => ({
  sendWithGas: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/email/templates', () => ({
  buildUserInvitationEmailHtml: jest.fn().mockReturnValue('<html></html>'),
}));

jest.mock('@/lib/utils/timezone', () => ({
  getCurrentDateJST: jest.fn().mockReturnValue('2026-03-18'),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

const mockAdminClient = {
  auth: {
    admin: {
      listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
    },
  },
};
const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
  typeof getAuthenticatedUserMetadata
>;

const buildGetRequest = (params: Record<string, string> = {}) => {
  const url = new URL('http://localhost/api/users');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
};

const buildPostRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** ユーザー一覧クエリのモックを構築するヘルパー */
function buildUsersQuery(usersData: unknown[]) {
  const usersQuery: Record<string, jest.Mock> = {
    select: jest.fn(),
    is: jest.fn(),
    eq: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    in: jest.fn(),
  };

  // チェーン設定
  usersQuery.select.mockReturnValue(usersQuery);
  usersQuery.is.mockReturnValue(usersQuery);
  usersQuery.eq.mockReturnValue(usersQuery);
  usersQuery.or.mockReturnValue(usersQuery);
  usersQuery.in.mockReturnValue(usersQuery);

  // order().order().order() チェーン → データを返す
  const innerMostOrder = jest.fn().mockResolvedValue({ data: usersData, error: null });
  const middleOrder = jest.fn().mockReturnValue({ order: innerMostOrder });
  usersQuery.order.mockReturnValue({ order: middleOrder });

  return usersQuery;
}

/** _user_class クエリのモックを構築するヘルパー */
function buildClassQuery(classData: unknown[] = []) {
  const classQuery: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
  };
  classQuery.select.mockReturnValue(classQuery);
  // .in() はチェーンを返し、.eq() が最終的なPromiseを返す
  classQuery.in.mockReturnValue(classQuery);
  classQuery.eq.mockResolvedValue({ data: classData, error: null });
  return classQuery;
}

// ---------------------------------------------------------------------------
// GET テスト
// ---------------------------------------------------------------------------

describe('GET /api/users - facility_id フィルター', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);
  });

  it('company_admin が facility_id パラメータを指定すると、その施設でフィルタされる', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const usersData = [
      {
        id: 'user-2',
        email: 'user2@example.com',
        name: '鈴木 二郎',
        name_kana: 'スズキ ジロウ',
        role: 'staff',
        phone: null,
        hire_date: '2024-01-01',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    const usersQuery = buildUsersQuery(usersData);
    const classQuery = buildClassQuery([]);

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return usersQuery;
        if (table === '_user_class') return classQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockedCreateClient.mockResolvedValue(mockSupabase as never);

    const request = buildGetRequest({ facility_id: 'facility-2' });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    // facility-2 でフィルターされていることを確認
    const eqCalls = usersQuery.eq.mock.calls;
    const facilityEqCall = eqCalls.find(
      ([col, val]: [string, string]) =>
        col === '_user_facility.facility_id' && val === 'facility-2'
    );
    expect(facilityEqCall).toBeDefined();
  });

  it('company_admin が別会社の施設IDを指定しても company_id フィルターにより別会社のユーザーは取得されない', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    // クエリは実行されるが、company_id フィルターにより別会社データは返らない想定
    const usersQuery = buildUsersQuery([]);
    const classQuery = buildClassQuery([]);

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return usersQuery;
        if (table === '_user_class') return classQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockedCreateClient.mockResolvedValue(mockSupabase as never);

    // 別会社の施設IDを指定
    const request = buildGetRequest({ facility_id: 'other-company-facility' });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    // company_id フィルターが適用されることを確認
    const eqCalls = usersQuery.eq.mock.calls;
    const companyEqCall = eqCalls.find(
      ([col, val]: [string, string]) => col === 'company_id' && val === 'company-1'
    );
    expect(companyEqCall).toBeDefined();

    // 指定した施設IDでもフィルターされることを確認
    const facilityEqCall = eqCalls.find(
      ([col, val]: [string, string]) =>
        col === '_user_facility.facility_id' && val === 'other-company-facility'
    );
    expect(facilityEqCall).toBeDefined();

    // 結果は空（company_idフィルターで別会社データは除外される）
    expect(json.data.users).toHaveLength(0);
  });

  it('facility_admin が facility_id パラメータを指定しても current_facility_id でフィルタされる（上書き不可）', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const usersData = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        name: '山田 太郎',
        name_kana: 'ヤマダ タロウ',
        role: 'staff',
        phone: null,
        hire_date: '2024-01-01',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    const usersQuery = buildUsersQuery(usersData);
    const classQuery = buildClassQuery([]);

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return usersQuery;
        if (table === '_user_class') return classQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockedCreateClient.mockResolvedValue(mockSupabase as never);

    // facility_admin が別施設を指定しようとする
    const request = buildGetRequest({ facility_id: 'facility-999' });
    const response = await GET(request);

    expect(response.status).toBe(200);

    const eqCalls = usersQuery.eq.mock.calls;

    // current_facility_id (facility-1) でフィルターされていること
    const correctFacilityEqCall = eqCalls.find(
      ([col, val]: [string, string]) =>
        col === '_user_facility.facility_id' && val === 'facility-1'
    );
    expect(correctFacilityEqCall).toBeDefined();

    // 指定した facility-999 では フィルターされていないこと
    const wrongFacilityEqCall = eqCalls.find(
      ([col, val]: [string, string]) =>
        col === '_user_facility.facility_id' && val === 'facility-999'
    );
    expect(wrongFacilityEqCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST テスト
// ---------------------------------------------------------------------------

describe('POST /api/users - facility_id 指定', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);
  });

  it('company_admin が body.facility_id を指定してユーザーを作成できる', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const mUsersQuery: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      insert: jest.fn(),
    };
    mUsersQuery.select.mockReturnValue(mUsersQuery);
    mUsersQuery.eq.mockReturnValue(mUsersQuery);
    mUsersQuery.is.mockReturnValue(mUsersQuery);
    mUsersQuery.insert.mockReturnValue(mUsersQuery);

    // メールアドレス重複チェック → 存在しない
    mUsersQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    // m_users insert 後の select().single() でユーザーデータを返す
    mUsersQuery.single.mockResolvedValue({
      data: {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'staff',
        hire_date: '2026-03-18',
        created_at: '2026-03-18T00:00:00.000Z',
      },
      error: null,
    });

    const userFacilityQuery = { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    const userClassQuery = { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    const companiesQuery: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn().mockResolvedValue({ data: { name: 'テスト会社' }, error: null }),
    };
    companiesQuery.select.mockReturnValue(companiesQuery);
    companiesQuery.eq.mockReturnValue(companiesQuery);

    const facilitiesQuery: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      single: jest.fn().mockResolvedValue({ data: { name: 'テスト施設B' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'facility-2' }, error: null }),
    };
    facilitiesQuery.select.mockReturnValue(facilitiesQuery);
    facilitiesQuery.eq.mockReturnValue(facilitiesQuery);
    facilitiesQuery.is.mockReturnValue(facilitiesQuery);

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return mUsersQuery;
        if (table === '_user_facility') return userFacilityQuery;
        if (table === '_user_class') return userClassQuery;
        if (table === 'm_companies') return companiesQuery;
        if (table === 'm_facilities') return facilitiesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const createUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'newuser@example.com' } },
      error: null,
    });
    const generateLink = jest.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://example.com/invite?token_hash=abc123&type=invite',
        },
      },
      error: null,
    });

    const mockAdmin = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: {
                    id: 'new-user-id',
                    email: 'newuser@example.com',
                    name: 'New User',
                    role: 'staff',
                    hire_date: '2026-04-01',
                  }, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {};
      }),
      auth: { admin: { createUser, generateLink, inviteUserByEmail: jest.fn(), updateUserById: jest.fn() } },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockedCreateAdminClient.mockResolvedValue(mockAdmin as never);

    // company_admin が facility-2 を指定してユーザーを作成
    const request = buildPostRequest({
      name: 'New User',
      email: 'newuser@example.com',
      phone: '090-1234-5678',
      role: 'staff',
      hire_date: '2026-04-01',
      facility_id: 'facility-2',
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    // createUser が facility-2 で呼ばれていることを確認
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          current_facility_id: 'facility-2',
        }),
      })
    );

    // _user_facility に facility-2 で紐付けされていることを確認
    expect(userFacilityQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        facility_id: 'facility-2',
      })
    );
  });

  it('facility_admin が body.facility_id を指定しても current_facility_id で施設紐付けされる', async () => {
    mockedGetMetadata.mockResolvedValue({
      user_id: 'test-user-id',
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const mUsersQuery: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      insert: jest.fn(),
    };
    mUsersQuery.select.mockReturnValue(mUsersQuery);
    mUsersQuery.eq.mockReturnValue(mUsersQuery);
    mUsersQuery.is.mockReturnValue(mUsersQuery);
    mUsersQuery.insert.mockReturnValue(mUsersQuery);

    // メールアドレス重複チェック → 存在しない
    mUsersQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    // m_users insert 後の select().single() でユーザーデータを返す
    mUsersQuery.single.mockResolvedValue({
      data: {
        id: 'new-user-id',
        email: 'staff2@example.com',
        name: 'New Staff',
        role: 'staff',
        hire_date: '2026-03-18',
        created_at: '2026-03-18T00:00:00.000Z',
      },
      error: null,
    });

    const userFacilityQuery = { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    const userClassQuery = { insert: jest.fn().mockResolvedValue({ data: null, error: null }) };
    const companiesQuery: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      single: jest.fn().mockResolvedValue({ data: { name: 'テスト会社' }, error: null }),
    };
    companiesQuery.select.mockReturnValue(companiesQuery);
    companiesQuery.eq.mockReturnValue(companiesQuery);

    const facilitiesQuery: Record<string, jest.Mock> = {
      select: jest.fn(),
      eq: jest.fn(),
      is: jest.fn(),
      single: jest.fn().mockResolvedValue({ data: { name: 'テスト施設A' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'facility-1' }, error: null }),
    };
    facilitiesQuery.select.mockReturnValue(facilitiesQuery);
    facilitiesQuery.eq.mockReturnValue(facilitiesQuery);
    facilitiesQuery.is.mockReturnValue(facilitiesQuery);

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return mUsersQuery;
        if (table === '_user_facility') return userFacilityQuery;
        if (table === '_user_class') return userClassQuery;
        if (table === 'm_companies') return companiesQuery;
        if (table === 'm_facilities') return facilitiesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const createUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'staff2@example.com' } },
      error: null,
    });
    const generateLink = jest.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://example.com/invite?token_hash=def456&type=invite',
        },
      },
      error: null,
    });

    const mockAdmin = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ 
                  data: {
                    id: 'new-user-id',
                    email: 'newuser@example.com',
                    name: 'New User',
                    role: 'staff',
                    hire_date: '2026-04-01',
                  }, 
                  error: null 
                }),
              }),
            }),
          };
        }
        return {};
      }),
      auth: { admin: { createUser, generateLink, inviteUserByEmail: jest.fn(), updateUserById: jest.fn() } },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockedCreateAdminClient.mockResolvedValue(mockAdmin as never);

    // facility_admin が別の施設IDを指定しようとする
    const request = buildPostRequest({
      name: 'New Staff',
      email: 'staff2@example.com',
      phone: '090-0000-0000',
      role: 'staff',
      hire_date: '2026-04-01',
      facility_id: 'facility-999',
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    // createUser が current_facility_id (facility-1) で呼ばれていることを確認
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          current_facility_id: 'facility-1',
        }),
      })
    );

    // _user_facility に current_facility_id (facility-1) で紐付けされていることを確認
    expect(userFacilityQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        facility_id: 'facility-1',
      })
    );
  });
});
