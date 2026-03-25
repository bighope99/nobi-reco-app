/** @jest-environment node */
/**
 * 引き継ぎ完了トグルAPI テスト
 * PATCH /api/handover/[id]/complete
 */

import { PATCH } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/jwt');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('PATCH /api/handover/[id]/complete', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);

    mockGetAuthenticatedUserMetadata.mockResolvedValue({
      user_id: 'user-123',
      role: 'staff',
      company_id: 'company-123',
      current_facility_id: 'facility-123',
    });
  });

  const createRequest = (body: Record<string, unknown>) =>
    new NextRequest('http://localhost/api/handover/test/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('認証されていない場合は401を返す', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

    const request = createRequest({ completed: true });
    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('無効なUUID形式の場合は400を返す', async () => {
    const request = createRequest({ completed: true });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'invalid-id' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid activity ID');
  });

  it('completedがboolean以外の場合は400を返す', async () => {
    const request = createRequest({ completed: 'yes' });
    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('boolean');
  });

  it('保育日誌が見つからない場合は404を返す', async () => {
    const mockFetchQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found', code: 'PGRST116' },
      }),
    };

    mockSupabase.from.mockReturnValue(mockFetchQuery);

    const request = createRequest({ completed: true });
    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('引き継ぎが無い保育日誌の場合は400を返す', async () => {
    const mockFetchQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: VALID_UUID, facility_id: 'facility-123', handover: null },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockFetchQuery);

    const request = createRequest({ completed: true });
    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('no handover');
  });

  it('完了状態をtrueに更新できる', async () => {
    const mockFetchQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: VALID_UUID, facility_id: 'facility-123', handover: '引き継ぎ内容' },
        error: null,
      }),
    };

    const mockUpdateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: VALID_UUID,
          handover_completed: true,
          handover_completed_at: '2026-03-22T10:00:00Z',
          handover_completed_by: 'user-123',
        },
        error: null,
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockFetchQuery;
      return mockUpdateQuery;
    });

    const request = createRequest({ completed: true });
    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.activity_id).toBe(VALID_UUID);
    expect(body.data.handover_completed).toBe(true);
  });

  it('完了状態をfalseに戻せる', async () => {
    const mockFetchQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: VALID_UUID, facility_id: 'facility-123', handover: '引き継ぎ内容' },
        error: null,
      }),
    };

    const mockUpdateQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: VALID_UUID,
          handover_completed: false,
          handover_completed_at: null,
          handover_completed_by: null,
        },
        error: null,
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockFetchQuery;
      return mockUpdateQuery;
    });

    const request = createRequest({ completed: false });
    const response = await PATCH(request, { params: Promise.resolve({ id: VALID_UUID }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.handover_completed).toBe(false);
    expect(body.data.handover_completed_at).toBeNull();
  });
});
