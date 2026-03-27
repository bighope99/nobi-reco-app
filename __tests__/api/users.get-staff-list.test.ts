/**
 * GET /api/users?is_active=true
 * 活動履歴・個別記録ページの記入者フィルタードロップダウン用スタッフ一覧取得テスト
 *
 * チケット2修正: staffロールでも同施設の全ユーザーが記録者候補として返るよう変更。
 * .eq('role', 'staff') フィルターを削除したため、staffロールでも 200 が返る。
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/users/route';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }));
jest.mock('@/lib/auth/jwt', () => ({ getAuthenticatedUserMetadata: jest.fn() }));

// POST で使われる依存モジュールも念のためモック
jest.mock('@/lib/email/gas', () => ({ sendWithGas: jest.fn() }));
jest.mock('@/lib/email/templates', () => ({ buildUserInvitationEmailHtml: jest.fn() }));
jest.mock('@/lib/utils/timezone', () => ({ getCurrentDateJST: jest.fn(() => '2026-01-01') }));

const mockAdminClient = {
  auth: {
    admin: {
      listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
    },
  },
};

describe('GET /api/users?is_active=true (記入者フィルター用スタッフ一覧)', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  // 認証メタデータ: staff ロール
  const staffMetadata = {
    user_id: 'user-1',
    role: 'staff' as const,
    company_id: 'company-1',
    current_facility_id: 'facility-1',
  };

  // 認証メタデータ: facility_admin ロール
  const facilityAdminMetadata = {
    user_id: 'admin-1',
    role: 'facility_admin' as const,
    company_id: 'company-1',
    current_facility_id: 'facility-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as any);
  });

  /**
   * ヘルパー: staff ロール向けのフルモックを構築する
   * staff ロールは単一クエリ（_user_facility!inner）で処理される
   */
  function buildStaffRoleMock(options: {
    resolvedData?: object[];
    resolvedError?: object | null;
  }) {
    const { resolvedData = [], resolvedError = null } = options;

    const eqCalls: Array<[string, unknown]> = [];
    const isCalls: Array<[string, unknown]> = [];

    const query: any = {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockImplementation((col: string, val: unknown) => {
        isCalls.push([col, val]);
        return query;
      }),
      eq: jest.fn().mockImplementation((col: string, val: unknown) => {
        eqCalls.push([col, val]);
        return query;
      }),
      ilike: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: resolvedData, error: resolvedError }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return query;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    return { mockSupabase, query, eqCalls, isCalls };
  }

  /**
   * ヘルパー: facility_admin ロール向けのフルモックを構築する
   * facility_admin ロールは m_users + _user_class の 2 クエリになる
   */
  function buildFacilityAdminMock(options: {
    usersData?: object[];
    usersError?: object | null;
    classData?: object[];
  }) {
    const {
      usersData = [],
      usersError = null,
      classData = [],
    } = options;

    const eqCalls: Array<[string, unknown]> = [];
    const isCalls: Array<[string, unknown]> = [];

    const usersQuery: any = {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockImplementation((col: string, val: unknown) => {
        isCalls.push([col, val]);
        return usersQuery;
      }),
      eq: jest.fn().mockImplementation((col: string, val: unknown) => {
        eqCalls.push([col, val]);
        return usersQuery;
      }),
      ilike: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnValue({
        order: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({ data: usersData, error: usersError }),
        })),
      }),
    };

    const classQuery: any = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: classData, error: null }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return usersQuery;
        if (table === '_user_class') return classQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    return { mockSupabase, usersQuery, classQuery, eqCalls, isCalls };
  }

  // ─────────────────────────────────────────────
  // テスト 1: staff ロールでも 200 が返ること（チケット2修正後）
  // ─────────────────────────────────────────────
  describe('1. staff ロールでも記録者一覧が取得できること', () => {
    it('staff ロール: 200 が返り、user_id と name が含まれること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const staffUsers = [
        { id: 'user-a', name: '山田 太郎', is_active: true },
        { id: 'user-b', name: '鈴木 花子', is_active: true },
      ];
      const { mockSupabase } = buildStaffRoleMock({ resolvedData: staffUsers });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.users).toHaveLength(2);
      expect(json.data.users[0]).toHaveProperty('user_id', 'user-a');
      expect(json.data.users[0]).toHaveProperty('name', '山田 太郎');
    });

    it('staff ロール: facility_admin を含む複数ロールのユーザーが返ること（role フィルターなし）', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      // role フィルターがなければ facility_admin なども含まれる
      const mixedUsers = [
        { id: 'user-a', name: '山田 太郎', is_active: true },
        { id: 'admin-a', name: '鈴木 施設長', is_active: true },
      ];
      const { mockSupabase, eqCalls } = buildStaffRoleMock({ resolvedData: mixedUsers });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.users).toHaveLength(2);

      // .eq('role', 'staff') が呼ばれていないこと（ロールフィルターが削除されている）
      const roleFilterCall = eqCalls.find(([col, val]) => col === 'role' && val === 'staff');
      expect(roleFilterCall).toBeUndefined();
    });

    it('facility_admin ロール: レスポンスに user_id と name が含まれること', async () => {
      mockedGetMetadata.mockResolvedValue(facilityAdminMetadata);

      const usersData = [
        {
          id: 'user-a',
          email: 'taro@example.com',
          name: '山田 太郎',
          name_kana: 'ヤマダ タロウ',
          role: 'staff',
          phone: null,
          hire_date: '2024-01-01',
          is_active: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
        },
      ];
      const { mockSupabase } = buildFacilityAdminMock({ usersData });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.users[0]).toHaveProperty('user_id', 'user-a');
      expect(json.data.users[0]).toHaveProperty('name', '山田 太郎');
    });
  });

  // ─────────────────────────────────────────────
  // テスト 2: 施設フィルターが正しく適用されること
  // ─────────────────────────────────────────────
  describe('2. 施設フィルターが適用されること', () => {
    it('staff ロール: .eq("_user_facility.facility_id", facility-1) が呼ばれること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const { mockSupabase, eqCalls } = buildStaffRoleMock({ resolvedData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      await GET(request);

      const facilityFilterCall = eqCalls.find(
        ([col, val]) => col === '_user_facility.facility_id' && val === 'facility-1'
      );
      expect(facilityFilterCall).toBeDefined();
    });

    it('staff ロール: .eq("_user_facility.is_current", true) が呼ばれること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const { mockSupabase, eqCalls } = buildStaffRoleMock({ resolvedData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      await GET(request);

      const isCurrentCall = eqCalls.find(
        ([col, val]) => col === '_user_facility.is_current' && val === true
      );
      expect(isCurrentCall).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // テスト 3: _user_facility.deleted_at IS NULL フィルターは発行されないこと
  // ─────────────────────────────────────────────
  describe('3. _user_facility.deleted_at フィルターは発行されないこと', () => {
    it('staff ロール: .is("_user_facility.deleted_at", null) が呼ばれないこと', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const { mockSupabase, isCalls } = buildStaffRoleMock({ resolvedData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      await GET(request);

      const deletedAtNullCall = isCalls.find(
        ([col, val]) => col === '_user_facility.deleted_at' && val === null
      );
      expect(deletedAtNullCall).toBeUndefined();
    });

    it('facility_admin ロール: .is("_user_facility.deleted_at", null) が呼ばれないこと', async () => {
      mockedGetMetadata.mockResolvedValue(facilityAdminMetadata);

      const { mockSupabase, isCalls } = buildFacilityAdminMock({ usersData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      await GET(request);

      const deletedAtNullCall = isCalls.find(
        ([col, val]) => col === '_user_facility.deleted_at' && val === null
      );
      expect(deletedAtNullCall).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // テスト 4: クエリエラー時のハンドリング
  // ─────────────────────────────────────────────
  describe('4. クエリエラー時のハンドリング', () => {
    it('staff ロール: クエリエラー時に success が false であること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const columnError = {
        code: '42703',
        message: 'column "_user_facility.is_current" does not exist',
        hint: null,
        details: null,
      };

      const { mockSupabase } = buildStaffRoleMock({ resolvedError: columnError });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      const response = await GET(request);
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.data).toBeUndefined();
    });

    it('facility_admin ロール: _user_facility 関連エラーで 500 が返ること', async () => {
      mockedGetMetadata.mockResolvedValue(facilityAdminMetadata);

      const schemaError = {
        code: '42P01',
        message: 'relation "_user_facility" does not exist',
        hint: null,
        details: null,
      };

      const { mockSupabase } = buildFacilityAdminMock({
        usersError: schemaError,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost/api/users?is_active=true');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
