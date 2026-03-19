/**
 * GET /api/users?is_active=true
 * 活動履歴・個別記録ページの記入者フィルタードロップダウン用スタッフ一覧取得テスト
 *
 * 背景: _user_facility テーブルのマイグレーションが欠損している場合、
 * このクエリが失敗してドロップダウンに何も表示されない問題が発生する。
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/users/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth/jwt', () => ({ getAuthenticatedUserMetadata: jest.fn() }));

// POST で使われる依存モジュールも念のためモック
jest.mock('@/lib/email/gas', () => ({ sendWithGas: jest.fn() }));
jest.mock('@/lib/email/templates', () => ({ buildUserInvitationEmailHtml: jest.fn() }));
jest.mock('@/lib/utils/timezone', () => ({ getCurrentDateJST: jest.fn(() => '2026-01-01') }));

describe('GET /api/users?is_active=true (記入者フィルター用スタッフ一覧)', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  // 認証メタデータ: staff ロールで is_active フィルターが適用されるパスを通す
  const staffMetadata = {
    user_id: 'user-1',
    role: 'staff' as const,
    company_id: 'company-1',
    current_facility_id: 'facility-1',
  };

  // 認証メタデータ: facility_admin ロールで _user_facility フィルターが適用されるパスを通す
  const facilityAdminMetadata = {
    user_id: 'admin-1',
    role: 'facility_admin' as const,
    company_id: 'company-1',
    current_facility_id: 'facility-1',
  };

  beforeEach(() => {
    jest.resetAllMocks();
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

    // 各フィルターメソッドへの呼び出しを追跡するため、参照を保持する
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
        // staff ロールは _user_class を参照しないのでここには来ない
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
        order: jest.fn().mockResolvedValue({ data: usersData, error: usersError }),
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
  // テスト 1: レスポンス形状の確認
  // ─────────────────────────────────────────────
  describe('1. is_active=true returns users with user_id and name fields', () => {
    it('staff ロール: レスポンスに user_id と name が含まれること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const usersData = [
        { id: 'user-a', name: '山田 太郎', role: 'staff', is_active: true },
        { id: 'user-b', name: '鈴木 花子', role: 'staff', is_active: true },
      ];
      const { mockSupabase } = buildStaffRoleMock({ resolvedData: usersData });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // 履歴ページコンポーネントが期待するフィールドを確認
      expect(json.data.users[0]).toHaveProperty('user_id');
      expect(json.data.users[0]).toHaveProperty('name');
      expect(json.data.users[0].user_id).toBe('user-a');
      expect(json.data.users[0].name).toBe('山田 太郎');
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

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.users[0]).toHaveProperty('user_id', 'user-a');
      expect(json.data.users[0]).toHaveProperty('name', '山田 太郎');
    });
  });

  // ─────────────────────────────────────────────
  // テスト 2: _user_facility.is_current フィルターの確認
  // ─────────────────────────────────────────────
  describe('2. _user_facility.is_current filter is applied', () => {
    it('staff ロール: .eq("_user_facility.is_current", true) が呼ばれること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const { mockSupabase, eqCalls } = buildStaffRoleMock({ resolvedData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      await GET(request);

      const isCurrentCall = eqCalls.find(
        ([col, val]) => col === '_user_facility.is_current' && val === true
      );
      expect(isCurrentCall).toBeDefined();
    });

    it('facility_admin ロール: .eq("_user_facility.is_current", true) が呼ばれること', async () => {
      mockedGetMetadata.mockResolvedValue(facilityAdminMetadata);

      const { mockSupabase, eqCalls } = buildFacilityAdminMock({ usersData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      await GET(request);

      const isCurrentCall = eqCalls.find(
        ([col, val]) => col === '_user_facility.is_current' && val === true
      );
      expect(isCurrentCall).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // テスト 3: _user_facility.deleted_at IS NULL フィルターは発行されないこと
  // _user_facility テーブルには deleted_at カラムが存在しない（docs/03_database.md 参照）。
  // このフィルターを発行すると "column does not exist" エラーで記入者一覧が空になる。
  // ─────────────────────────────────────────────
  describe('3. _user_facility.deleted_at フィルターは発行されないこと', () => {
    it('staff ロール: .is("_user_facility.deleted_at", null) が呼ばれないこと', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const { mockSupabase, isCalls } = buildStaffRoleMock({ resolvedData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
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

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      await GET(request);

      const deletedAtNullCall = isCalls.find(
        ([col, val]) => col === '_user_facility.deleted_at' && val === null
      );
      expect(deletedAtNullCall).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────
  // テスト 4: is_active=true フィルターの確認
  // ─────────────────────────────────────────────
  describe('4. is_active=true filter is applied', () => {
    it('staff ロール: .eq("is_active", true) が呼ばれること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const { mockSupabase, eqCalls } = buildStaffRoleMock({ resolvedData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      await GET(request);

      const isActiveCall = eqCalls.find(
        ([col, val]) => col === 'is_active' && val === true
      );
      expect(isActiveCall).toBeDefined();
    });

    it('facility_admin ロール: .eq("is_active", true) が呼ばれること', async () => {
      mockedGetMetadata.mockResolvedValue(facilityAdminMetadata);

      const { mockSupabase, eqCalls } = buildFacilityAdminMock({ usersData: [] });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      await GET(request);

      const isActiveCall = eqCalls.find(
        ([col, val]) => col === 'is_active' && val === true
      );
      expect(isActiveCall).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // テスト 5: _user_facility クエリ失敗時（スキーマ欠損シミュレーション）
  // ─────────────────────────────────────────────
  describe('5. When _user_facility query fails (simulating missing schema), returns error response', () => {
    it('staff ロール: _user_facility 関連エラーで 500 が返ること', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const schemaError = {
        code: '42P01',
        message: 'relation "_user_facility" does not exist',
        hint: null,
        details: null,
      };

      const { mockSupabase } = buildStaffRoleMock({ resolvedError: schemaError });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
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

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it('クエリエラー時にレスポンスの success が false であること（空リストにはならない）', async () => {
      mockedGetMetadata.mockResolvedValue(staffMetadata);

      const columnError = {
        code: '42703',
        message: 'column "_user_facility.is_current" does not exist',
        hint: null,
        details: null,
      };

      const { mockSupabase } = buildStaffRoleMock({ resolvedError: columnError });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/users?is_active=true'
      );
      const response = await GET(request);
      const json = await response.json();

      // エラー時は空リストを返すのではなく、エラーとして扱われるべき
      expect(json.success).toBe(false);
      expect(json.data).toBeUndefined();
    });
  });
});
