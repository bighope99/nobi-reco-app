import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/facilities/[facility_id]/route';
import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

const buildRequest = (body: Record<string, unknown> = {}) =>
  new NextRequest('http://localhost/api/facilities/facility-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'テスト施設',
      address: '東京都渋谷区1-1-1',
      phone: '03-1234-5678',
      ...body,
    }),
  });

function buildMockSupabase({
  role,
  userCompanyId,
  facilityCompanyId = 'company-1',
  authUser = { id: 'user-1' } as { id: string } | null,
  authError = null as Error | null,
}) {
  const authGetUser = jest.fn().mockResolvedValue({
    data: { user: authUser },
    error: authError,
  });

  const userQuery: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: role ? { role, company_id: userCompanyId } : null,
      error: null,
    }),
  };

  const facilitySelectQuery: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { company_id: facilityCompanyId },
      error: null,
    }),
  };

  const facilityUpdateQuery: any = {
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'facility-1', name: 'テスト施設', updated_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    }),
  };

  let facilityCallCount = 0;
  const mockSupabase = {
    auth: { getUser: authGetUser },
    from: jest.fn((table: string) => {
      if (table === 'm_users') return userQuery;
      if (table === 'm_facilities') {
        facilityCallCount += 1;
        return facilityCallCount === 1 ? facilitySelectQuery : facilityUpdateQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { mockSupabase, facilityUpdateQuery };
}

describe('PUT /api/facilities/:facility_id', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('facility_admin（同じ会社）は施設情報を更新できる', async () => {
    const { mockSupabase, facilityUpdateQuery } = buildMockSupabase({
      role: 'facility_admin',
      userCompanyId: 'company-1',
      facilityCompanyId: 'company-1',
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await PUT(buildRequest(), {
      params: Promise.resolve({ facility_id: 'facility-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(facilityUpdateQuery.update).toHaveBeenCalled();
  });

  it('staff は 403 Permission denied を返す', async () => {
    const { mockSupabase } = buildMockSupabase({
      role: 'staff',
      userCompanyId: 'company-1',
      facilityCompanyId: 'company-1',
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await PUT(buildRequest(), {
      params: Promise.resolve({ facility_id: 'facility-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Permission denied');
  });

  it('site_admin は別会社の施設も更新できる', async () => {
    const { mockSupabase, facilityUpdateQuery } = buildMockSupabase({
      role: 'site_admin',
      userCompanyId: 'company-99',
      facilityCompanyId: 'company-1',
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await PUT(buildRequest(), {
      params: Promise.resolve({ facility_id: 'facility-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(facilityUpdateQuery.update).toHaveBeenCalled();
  });

  it('facility_admin（別会社）は 404 Access denied を返す', async () => {
    const { mockSupabase } = buildMockSupabase({
      role: 'facility_admin',
      userCompanyId: 'company-2',
      facilityCompanyId: 'company-1',
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await PUT(buildRequest(), {
      params: Promise.resolve({ facility_id: 'facility-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Access denied');
  });

  it('未認証の場合は 401 を返す', async () => {
    const { mockSupabase } = buildMockSupabase({
      role: 'facility_admin',
      userCompanyId: 'company-1',
      authUser: null,
      authError: new Error('Unauthorized'),
    });
    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await PUT(buildRequest(), {
      params: Promise.resolve({ facility_id: 'facility-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });
});
