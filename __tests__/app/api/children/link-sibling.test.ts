/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/children/link-sibling/route';

// ---------------------------------------------------------------------------
// モック宣言
// ---------------------------------------------------------------------------

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/lib/children/guardian-sync', () => ({
  syncGuardiansBidirectional: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { syncGuardiansBidirectional } from '@/lib/children/guardian-sync';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
  typeof getAuthenticatedUserMetadata
>;
const mockSyncGuardiansBidirectional = syncGuardiansBidirectional as jest.MockedFunction<
  typeof syncGuardiansBidirectional
>;

// ---------------------------------------------------------------------------
// Supabase チェーンモックビルダー
//
// POST /api/children/link-sibling が実行するクエリシーケンス:
//   1. m_children       : .select(...).in(...).eq('facility_id', ...).is('deleted_at', null)
//   2. _child_sibling   : .select('id').or(...)
//   3. _child_sibling   : .insert(siblingRecords)
// ---------------------------------------------------------------------------

interface CreateSupabaseMockOptions {
  childrenData?: Array<{
    id: string;
    family_name: string;
    given_name: string;
    facility_id: string;
  }> | null;
  childrenError?: { message: string } | null;
  existingLinksData?: Array<{ id: string }> | null;
  insertError?: { message: string } | null;
}

const createSupabaseMock = (options: CreateSupabaseMockOptions = {}) => {
  const {
    childrenData = null,
    childrenError = null,
    existingLinksData = [],
    insertError = null,
  } = options;

  const insertMock = jest.fn().mockResolvedValue({ error: insertError });

  return {
    from: jest.fn((table: string) => {
      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockResolvedValue({
                  data: childrenData,
                  error: childrenError,
                }),
              }),
            }),
          }),
        };
      }

      if (table === '_child_sibling') {
        return {
          select: jest.fn().mockReturnValue({
            or: jest.fn().mockResolvedValue({
              data: existingLinksData,
              error: null,
            }),
          }),
          insert: insertMock,
        };
      }

      return {};
    }),
    _insertMock: insertMock,
  };
};

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

const VALID_METADATA = {
  user_id: 'user-1',
  role: 'staff' as const,
  current_facility_id: 'facility-1',
  company_id: 'company-1',
};

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/children/link-sibling', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const TWO_CHILDREN = [
  { id: 'child-a', family_name: '山田', given_name: '太郎', facility_id: 'facility-1' },
  { id: 'child-b', family_name: '山田', given_name: '花子', facility_id: 'facility-1' },
];

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe('POST /api/children/link-sibling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncGuardiansBidirectional.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // 認証・認可
  // -------------------------------------------------------------------------

  describe('認証なし', () => {
    it('metadata が null → 401 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('ロール検証', () => {
    it.each([
      ['unknown_role'],
      ['guest'],
      [''],
    ])('不正ロール "%s" → 403 を返す', async (role) => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        ...VALID_METADATA,
        role: role as any,
      });
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it.each([
      ['facility_admin'],
      ['staff'],
      ['site_admin'],
      ['company_admin'],
    ])('許可ロール "%s" は認可される（ロールチェックで403にならない）', async (role) => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        ...VALID_METADATA,
        role: role as any,
      });
      const supabase = createSupabaseMock({ childrenData: TWO_CHILDREN });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));

      expect(response.status).not.toBe(403);
    });
  });

  describe('current_facility_id なし', () => {
    it('current_facility_id が null → 404 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        ...VALID_METADATA,
        current_facility_id: null,
      });
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Facility not found');
    });
  });

  // -------------------------------------------------------------------------
  // リクエストボディバリデーション
  // -------------------------------------------------------------------------

  describe('リクエストボディバリデーション', () => {
    beforeEach(() => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase as any);
    });

    it('child_id がない → 400 を返す', async () => {
      const response = await POST(makeRequest({ sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('child_id and sibling_id are required');
    });

    it('sibling_id がない → 400 を返す', async () => {
      const response = await POST(makeRequest({ child_id: 'child-a' }));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('child_id and sibling_id are required');
    });

    it('child_id と sibling_id が両方ない → 400 を返す', async () => {
      const response = await POST(makeRequest({}));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('child_id and sibling_id are required');
    });

    it('自己リンク (child_id === sibling_id) → 400 を返す', async () => {
      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-a' }));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Cannot link a child to themselves');
    });
  });

  // -------------------------------------------------------------------------
  // 正常系
  // -------------------------------------------------------------------------

  describe('正常系', () => {
    it('兄弟リンク成功 → 200 を返し syncGuardiansBidirectional が呼ばれる', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock({ childrenData: TWO_CHILDREN });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('兄弟姉妹を紐付けました');
      expect(json.data.sibling_name).toBe('山田 花子');

      expect(mockSyncGuardiansBidirectional).toHaveBeenCalledTimes(1);
      expect(mockSyncGuardiansBidirectional).toHaveBeenCalledWith(
        expect.anything(),
        'child-a',
        'child-b',
        'facility-1'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 404: 別施設の子ども
  // -------------------------------------------------------------------------

  describe('別施設の子ども', () => {
    it('片方または両方が現在施設に属さない → 404 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      // 施設フィルタにより1件しか返らない（2件揃わない）
      const supabase = createSupabaseMock({
        childrenData: [
          { id: 'child-a', family_name: '山田', given_name: '太郎', facility_id: 'facility-1' },
        ],
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('One or both children not found in current facility');
    });

    it('children データが null の場合も 404 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock({ childrenData: null });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('One or both children not found in current facility');
    });
  });

  // -------------------------------------------------------------------------
  // 409: 既存リンク
  // -------------------------------------------------------------------------

  describe('既存リンク', () => {
    it('既存の兄弟関係がある → 409 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock({
        childrenData: TWO_CHILDREN,
        existingLinksData: [{ id: 'link-1' }], // 既存リンクあり
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.error).toBe('Sibling relationship already exists');
    });
  });

  // -------------------------------------------------------------------------
  // syncGuardiansBidirectional エラー時でも兄弟リンクは成功
  // -------------------------------------------------------------------------

  describe('保護者同期エラーの分離', () => {
    it('syncGuardiansBidirectional がエラーをthrowしても 200 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock({ childrenData: TWO_CHILDREN });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockSyncGuardiansBidirectional.mockRejectedValue(
        new Error('Guardian sync failed unexpectedly')
      );

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      // 兄弟リンクの成功は保護者同期エラーに依存しない
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe('兄弟姉妹を紐付けました');
    });
  });

  // -------------------------------------------------------------------------
  // 500: サーバーエラー
  // -------------------------------------------------------------------------

  describe('サーバーエラー', () => {
    it('children クエリエラー時 → 500 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock({
        childrenError: { message: 'DB error' },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch children');
    });

    it('insert エラー時 → 500 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      const supabase = createSupabaseMock({
        childrenData: TWO_CHILDREN,
        existingLinksData: [],
        insertError: { message: 'Insert failed' },
      });
      mockCreateClient.mockResolvedValue(supabase as any);

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to link siblings');
    });

    it('createClient が例外をthrowした場合 → 500 を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(VALID_METADATA);
      mockCreateClient.mockRejectedValue(new Error('Client init error'));

      const response = await POST(makeRequest({ child_id: 'child-a', sibling_id: 'child-b' }));
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal Server Error');
    });
  });
});
