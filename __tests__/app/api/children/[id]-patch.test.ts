/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/children/[id]/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

// ---------------------------------------------------------------------------
// モック宣言
// ---------------------------------------------------------------------------

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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
  typeof getAuthenticatedUserMetadata
>;

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/children/child-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const buildParams = (id = 'child-1') => ({ params: Promise.resolve({ id }) });

/**
 * m_children.update チェーンモックを生成する。
 * 更新が成功した場合は updatedRows を返し、失敗した場合は updateError を返す。
 */
const createUpdateMock = (options: {
  updatedRows?: Array<{ id: string }>;
  updateError?: { message: string } | null;
} = {}) => {
  const { updatedRows = [{ id: 'child-1' }], updateError = null } = options;

  const selectMock = jest.fn().mockResolvedValue({
    data: updatedRows,
    error: updateError,
  });
  const isDeletedAtMock = jest.fn(() => ({ select: selectMock }));
  const eqFacilityMock = jest.fn(() => ({ is: isDeletedAtMock }));
  const eqIdMock = jest.fn(() => ({ eq: eqFacilityMock }));
  const updateMock = jest.fn(() => ({ eq: eqIdMock }));

  const mockSupabase = {
    from: jest.fn((table: string) => {
      if (table === 'm_children') return { update: updateMock };
      throw new Error(`Unexpected table: ${table}`);
    }),
    _updateMock: updateMock,
  };

  return mockSupabase;
};

// ---------------------------------------------------------------------------
// テストスイート
// ---------------------------------------------------------------------------

describe('PATCH /api/children/[id]', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. ロールチェック: staff → 403
  // -------------------------------------------------------------------------
  describe('ロールチェック', () => {
    it('staff ロールで PATCH すると 403 Forbidden を返すこと', async () => {
      // Given: staff ロールで認証済み
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        company_id: 'company-1',
        current_facility_id: 'facility-1',
      });
      mockCreateClient.mockResolvedValue(createUpdateMock() as any);

      // When: PATCH リクエストを送信
      const request = buildRequest({ enrollment_status: 'suspended' });
      const response = await PATCH(request, buildParams());
      const json = await response.json();

      // Then: 403 Forbidden
      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });
  });

  // -------------------------------------------------------------------------
  // 2. facility_admin で suspended → 200 + withdrawn_at: null
  // -------------------------------------------------------------------------
  describe('正常系: facility_admin', () => {
    beforeEach(() => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'facility_admin',
        company_id: 'company-1',
        current_facility_id: 'facility-1',
      });
    });

    it('enrollment_status=suspended の場合、withdrawn_at: null が update に含まれること', async () => {
      // Given
      const mockSupabase = createUpdateMock();
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      // When
      const request = buildRequest({ enrollment_status: 'suspended' });
      const response = await PATCH(request, buildParams());
      const json = await response.json();

      // Then: 200 + withdrawn_at: null
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateArg = (mockSupabase._updateMock.mock.calls as any[])[0][0];
      expect(updateArg.enrollment_status).toBe('suspended');
      expect(updateArg.withdrawn_at).toBeNull();
    });

    it('enrollment_status=withdrawn の場合、withdrawn_at に日時が設定されること', async () => {
      // Given
      const mockSupabase = createUpdateMock();
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      const beforeRequest = new Date();

      // When
      const request = buildRequest({ enrollment_status: 'withdrawn' });
      const response = await PATCH(request, buildParams());
      const json = await response.json();

      const afterRequest = new Date();

      // Then: 200 + withdrawn_at が日時文字列
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateArg = (mockSupabase._updateMock.mock.calls as any[])[0][0];
      expect(updateArg.enrollment_status).toBe('withdrawn');
      expect(typeof updateArg.withdrawn_at).toBe('string');

      // withdrawn_at はリクエスト前後の時刻範囲内であること
      const withdrawnAt = new Date(updateArg.withdrawn_at as string);
      expect(withdrawnAt.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime() - 1000);
      expect(withdrawnAt.getTime()).toBeLessThanOrEqual(afterRequest.getTime() + 1000);
    });

    it('enrollment_status=enrolled の場合、withdrawn_at: null が update に含まれること', async () => {
      // Given
      const mockSupabase = createUpdateMock();
      mockCreateClient.mockResolvedValue(mockSupabase as any);

      // When
      const request = buildRequest({ enrollment_status: 'enrolled' });
      const response = await PATCH(request, buildParams());
      const json = await response.json();

      // Then: 200 + withdrawn_at: null
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateArg = (mockSupabase._updateMock.mock.calls as any[])[0][0];
      expect(updateArg.enrollment_status).toBe('enrolled');
      expect(updateArg.withdrawn_at).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. 認証なし → 401
  // -------------------------------------------------------------------------
  describe('認証チェック', () => {
    it('metadata が null の場合、401 Unauthorized を返すこと', async () => {
      // Given: 未認証
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);
      mockCreateClient.mockResolvedValue({} as any);

      // When
      const request = buildRequest({ enrollment_status: 'suspended' });
      const response = await PATCH(request, buildParams());
      const json = await response.json();

      // Then: 401
      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  // -------------------------------------------------------------------------
  // 6. 不正な値 → 400
  // -------------------------------------------------------------------------
  describe('バリデーション', () => {
    it('enrollment_status に不正な値が渡された場合、400 を返すこと', async () => {
      // Given: 認証済み facility_admin
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'facility_admin',
        company_id: 'company-1',
        current_facility_id: 'facility-1',
      });
      mockCreateClient.mockResolvedValue(createUpdateMock() as any);

      // When: 不正な値 "invalid" を送信
      const request = buildRequest({ enrollment_status: 'invalid' });
      const response = await PATCH(request, buildParams());
      const json = await response.json();

      // Then: 400
      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid enrollment_status');
    });
  });
});
