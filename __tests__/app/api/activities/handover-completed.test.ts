/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/activities/route';

// モック
jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { createClient } from '@/utils/supabase/server';

describe('/api/activities GET - handover_completed機能', () => {
  const buildMockSupabase = (activities: unknown[]) => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
      getClaims: jest.fn().mockResolvedValue({
        data: {
          claims: {
            sub: 'test-user-id',
            app_metadata: {
              role: 'staff',
              company_id: 'test-company-id',
              current_facility_id: 'test-facility-id',
            },
          },
        },
        error: null,
      }),
    },
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    },
    from: jest.fn((tableName: string) => {
      if (tableName === 'r_activity') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue({
            data: activities,
            error: null,
            count: activities.length,
          }),
        };
      }
      if (tableName === 'r_observation') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
      return {};
    }),
  });

  const baseActivity = {
    facility_id: 'test-facility-id',
    activity_date: '2026-01-09',
    title: 'テスト活動',
    content: '今日は公園で遊びました',
    snack: 'りんご',
    photos: null,
    class_id: 'class-1',
    mentioned_children: [],
    created_at: '2026-01-09T10:00:00Z',
    updated_at: '2026-01-09T10:00:00Z',
    m_classes: { id: 'class-1', name: 'ひまわり組' },
    m_users: { id: 'test-user-id', name: 'Test User' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handover_completed: true の活動記録がレスポンスに含まれること', async () => {
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue({
      user_id: 'test-user-id',
      current_facility_id: 'test-facility-id',
      company_id: 'test-company-id',
    });

    const mockActivity = {
      ...baseActivity,
      id: 'activity-handover-true',
      handover: '明日の連絡事項があります',
      handover_completed: true,
    };

    (createClient as jest.Mock).mockResolvedValue(buildMockSupabase([mockActivity]));

    const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.activities).toHaveLength(1);

    const activity = data.data.activities[0];
    expect(activity.handover_completed).toBe(true);
  });

  it('handover_completed: false の活動記録がレスポンスに含まれること', async () => {
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue({
      user_id: 'test-user-id',
      current_facility_id: 'test-facility-id',
      company_id: 'test-company-id',
    });

    const mockActivity = {
      ...baseActivity,
      id: 'activity-handover-false',
      handover: '未対応の引き継ぎ事項です',
      handover_completed: false,
    };

    (createClient as jest.Mock).mockResolvedValue(buildMockSupabase([mockActivity]));

    const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.activities).toHaveLength(1);

    const activity = data.data.activities[0];
    expect(activity.handover_completed).toBe(false);
  });

  it('handover が null の場合は handover_completed が false になること', async () => {
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue({
      user_id: 'test-user-id',
      current_facility_id: 'test-facility-id',
      company_id: 'test-company-id',
    });

    const mockActivity = {
      ...baseActivity,
      id: 'activity-no-handover',
      handover: null,
      handover_completed: null,
    };

    (createClient as jest.Mock).mockResolvedValue(buildMockSupabase([mockActivity]));

    const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.activities).toHaveLength(1);

    const activity = data.data.activities[0];
    expect(activity.handover).toBeNull();
    expect(activity.handover_completed).toBe(false);
  });
});
