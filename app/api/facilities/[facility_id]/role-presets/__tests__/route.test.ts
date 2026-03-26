/** @jest-environment node */
/**
 * 役割プリセットAPIのテスト
 * GET  /api/facilities/:facility_id/role-presets
 * POST /api/facilities/:facility_id/role-presets
 */

import { GET, POST } from '../route';
import { DELETE } from '../[preset_id]/route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
  hasPermission: jest.fn(),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;
const mockHasPermission = hasPermission as jest.MockedFunction<typeof hasPermission>;

const FACILITY_ID = 'facility-123';
const PRESET_ID = 'preset-uuid-1';

const STAFF_METADATA = {
  user_id: 'user-123',
  role: 'staff' as const,
  company_id: 'company-123',
  current_facility_id: FACILITY_ID,
};

const ADMIN_METADATA = {
  ...STAFF_METADATA,
  role: 'facility_admin' as const,
};

const makeParams = (extra: Record<string, string> = {}) =>
  Promise.resolve({ facility_id: FACILITY_ID, ...extra });

const makeRequest = (method: string, body?: object) =>
  new NextRequest(`http://localhost/api/facilities/${FACILITY_ID}/role-presets`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('GET /api/facilities/:facility_id/role-presets', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetMetadata.mockResolvedValue(STAFF_METADATA);
    mockHasPermission.mockReturnValue(true);
  });

  it('プリセット一覧を sort_order 順で返す', async () => {
    const presets = [
      { id: PRESET_ID, role_name: '司会', sort_order: 0 },
      { id: 'preset-uuid-2', role_name: '記録', sort_order: 1 },
    ];

    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: presets, error: null }),
    };
    mockSupabase.from.mockReturnValue(mockChain);

    const response = await GET(makeRequest('GET'), { params: makeParams() });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.presets).toHaveLength(2);
    expect(body.presets[0].role_name).toBe('司会');
    // 施設IDフィルタが呼ばれていること
    expect(mockChain.eq).toHaveBeenCalledWith('facility_id', FACILITY_ID);
  });

  it('未認証の場合 401 を返す', async () => {
    mockGetMetadata.mockResolvedValue(null);

    const response = await GET(makeRequest('GET'), { params: makeParams() });
    expect(response.status).toBe(401);
  });

  it('異なる施設IDを指定した場合 403 を返す', async () => {
    mockGetMetadata.mockResolvedValue({
      ...STAFF_METADATA,
      current_facility_id: 'other-facility-id',
    });

    const response = await GET(makeRequest('GET'), { params: makeParams() });
    expect(response.status).toBe(403);
  });
});

describe('POST /api/facilities/:facility_id/role-presets', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetMetadata.mockResolvedValue(ADMIN_METADATA);
    mockHasPermission.mockReturnValue(true);
  });

  it('プリセットを正常に追加できる', async () => {
    const newPreset = { id: PRESET_ID, role_name: '司会', sort_order: 0 };

    // 重複チェック: 既存なし
    const checkChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    // sort_order 最大値取得
    const maxOrderChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    // INSERT
    const insertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: newPreset, error: null }),
    };

    mockSupabase.from
      .mockReturnValueOnce(checkChain)
      .mockReturnValueOnce(maxOrderChain)
      .mockReturnValueOnce(insertChain);

    const response = await POST(makeRequest('POST', { role_name: '司会' }), { params: makeParams() });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.preset.role_name).toBe('司会');
  });

  it('重複 role_name の場合はスキップして既存を返す', async () => {
    const existingPreset = { id: PRESET_ID };

    const checkChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: existingPreset, error: null }),
    };
    mockSupabase.from.mockReturnValue(checkChain);

    const response = await POST(makeRequest('POST', { role_name: '司会' }), { params: makeParams() });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.skipped).toBe(true);
    expect(body.preset.id).toBe(PRESET_ID);
  });

  it('staff ロールで POST すると 403 を返す', async () => {
    mockGetMetadata.mockResolvedValue(STAFF_METADATA);
    mockHasPermission.mockReturnValue(false);

    const response = await POST(makeRequest('POST', { role_name: '司会' }), { params: makeParams() });
    expect(response.status).toBe(403);
  });

  it('role_name が空の場合 400 を返す', async () => {
    const response = await POST(makeRequest('POST', { role_name: '' }), { params: makeParams() });
    expect(response.status).toBe(400);
  });

  it('role_name が 50 文字超の場合 400 を返す', async () => {
    const response = await POST(makeRequest('POST', { role_name: 'a'.repeat(51) }), { params: makeParams() });
    expect(response.status).toBe(400);
  });

  it('異なる施設IDを指定した場合 403 を返す', async () => {
    mockGetMetadata.mockResolvedValue({
      ...ADMIN_METADATA,
      current_facility_id: 'other-facility-id',
    });

    const response = await POST(makeRequest('POST', { role_name: '司会' }), { params: makeParams() });
    expect(response.status).toBe(403);
  });
});

describe('DELETE /api/facilities/:facility_id/role-presets/:preset_id', () => {
  let mockSupabase: any;

  const makeDeleteRequest = () =>
    new NextRequest(`http://localhost/api/facilities/${FACILITY_ID}/role-presets/${PRESET_ID}`, {
      method: 'DELETE',
    });

  const makeDeleteParams = () =>
    Promise.resolve({ facility_id: FACILITY_ID, preset_id: PRESET_ID });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = { from: jest.fn() };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetMetadata.mockResolvedValue(ADMIN_METADATA);
    mockHasPermission.mockReturnValue(true);
  });

  it('論理削除（deleted_at 設定）が実行される', async () => {
    const updateChain = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from.mockReturnValue(updateChain);

    const response = await DELETE(makeDeleteRequest(), { params: makeDeleteParams() });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // deleted_at を設定する update が呼ばれていること
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    );
  });

  it('staff ロールで DELETE すると 403 を返す', async () => {
    mockGetMetadata.mockResolvedValue(STAFF_METADATA);
    mockHasPermission.mockReturnValue(false);

    const response = await DELETE(makeDeleteRequest(), { params: makeDeleteParams() });
    expect(response.status).toBe(403);
  });
});
