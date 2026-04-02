/** @jest-environment node */
/**
 * 活動記録テンプレート削除APIのテスト
 * DELETE /api/activity-templates/[id]
 */

import { DELETE } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/jwt');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

const ADMIN_METADATA = {
  user_id: 'user-123',
  role: 'facility_admin' as const,
  company_id: 'company-123',
  current_facility_id: 'facility-123',
};

const STAFF_METADATA = {
  ...ADMIN_METADATA,
  role: 'staff' as const,
};

const makeRequest = () =>
  new NextRequest('http://localhost/api/activity-templates/template-1', {
    method: 'DELETE',
  });

const makeParams = (id: string) => Promise.resolve({ id });

describe('DELETE /api/activity-templates/[id]', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  it('facility_admin は自施設テンプレートを削除できる', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(ADMIN_METADATA);

    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'template-1', facility_id: 'facility-123' },
        error: null,
      }),
      update: jest.fn().mockReturnThis(),
    };
    // update チェーンの最終メソッド
    const mockUpdate = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };
    mockSupabase.from
      .mockReturnValueOnce(mockChain)  // SELECT用
      .mockReturnValueOnce(mockUpdate); // UPDATE用

    const response = await DELETE(makeRequest(), { params: makeParams('template-1') });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('staff は削除できず 403 を返す', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(STAFF_METADATA);

    const response = await DELETE(makeRequest(), { params: makeParams('template-1') });
    expect(response.status).toBe(403);
  });

  it('他施設のテンプレートは削除できず 403 を返す', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(ADMIN_METADATA);

    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'template-1', facility_id: 'other-facility' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValue(mockChain);

    const response = await DELETE(makeRequest(), { params: makeParams('template-1') });
    expect(response.status).toBe(403);
  });

  it('存在しないテンプレートは 404 を返す', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(ADMIN_METADATA);

    const mockChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      }),
    };
    mockSupabase.from.mockReturnValue(mockChain);

    const response = await DELETE(makeRequest(), { params: makeParams('nonexistent') });
    expect(response.status).toBe(404);
  });
});
