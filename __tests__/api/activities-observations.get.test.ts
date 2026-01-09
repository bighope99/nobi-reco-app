import { NextRequest } from 'next/server';
import { GET } from '@/app/api/activities/[id]/observations/route';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

const buildRequest = () =>
  new NextRequest('http://localhost/api/activities/activity-1/observations', {
    method: 'GET',
  });

describe('GET /api/activities/:id/observations', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetUserSession = getUserSession as jest.MockedFunction<typeof getUserSession>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns observations linked to the activity', async () => {
    mockedGetUserSession.mockResolvedValue({
      user_id: 'user-1',
      email: 'test@example.com',
      name: 'テスト',
      role: 'staff',
      company_id: 'company-1',
      company_name: 'Test Co',
      current_facility_id: 'facility-1',
      facilities: [],
      classes: [],
    });

    const authQuery = {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    };

    const activityQuery: any = {
      select: jest.fn(() => activityQuery),
      eq: jest.fn(() => activityQuery),
      is: jest.fn(() => activityQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'activity-1', facility_id: 'facility-1' },
        error: null,
      }),
    };

    const observationQuery: any = {
      select: jest.fn(() => observationQuery),
      eq: jest.fn(() => observationQuery),
      is: jest.fn(() => observationQuery),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'obs-1',
            child_id: 'child-1',
            observation_date: '2024-01-01',
            content: 'ブロックで遊んだ',
            created_at: '2024-01-01T00:00:00.000Z',
            m_children: {
              family_name: '山田',
              given_name: '花子',
              nickname: 'はな',
            },
          },
        ],
        error: null,
      }),
    };

    const mockSupabase = {
      auth: authQuery,
      from: jest.fn((table: string) => {
        if (table === 'r_activity') return activityQuery;
        if (table === 'r_observation') return observationQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const response = await GET(buildRequest(), { params: Promise.resolve({ id: 'activity-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.observations).toHaveLength(1);
    expect(json.data.observations[0]).toMatchObject({
      observation_id: 'obs-1',
      child_id: 'child-1',
      child_name: 'はな',
    });
    expect(activityQuery.eq).toHaveBeenCalledWith('id', 'activity-1');
  });
});
