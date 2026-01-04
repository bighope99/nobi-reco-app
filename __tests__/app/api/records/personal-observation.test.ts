/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/records/personal/[id]/route';

jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/personal/[id]', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockSession = {
    user_id: 'test-user-id',
    current_facility_id: 'test-facility-id',
  };

  const buildSupabaseMock = ({
    observationResult,
    createdByResult,
    recentResult,
  }: {
    observationResult: { data: any; error: any };
    createdByResult: { data: any; error: any };
    recentResult: { data: any; error: any };
  }) => {
    let observationCallCount = 0;
    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'r_observation') {
          observationCallCount += 1;
          const isDetailQuery = observationCallCount === 1;
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue(recentResult),
            single: jest.fn().mockResolvedValue(
              isDetailQuery ? observationResult : { data: null, error: null },
            ),
          };
        }
        if (table === 'm_users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue(createdByResult),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
        };
      }),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('認証されていない場合は401を返すこと', async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        }),
      },
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const request = new NextRequest('http://localhost:3000/api/records/personal/test-id', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('データが見つからない場合は404を返すこと', async () => {
    (getUserSession as jest.Mock).mockResolvedValue(mockSession);
    (createClient as jest.Mock).mockResolvedValue(
      buildSupabaseMock({
        observationResult: { data: null, error: new Error('Not found') },
        createdByResult: { data: null, error: null },
        recentResult: { data: [], error: null },
      }),
    );

    const request = new NextRequest('http://localhost:3000/api/records/personal/test-id', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('データが見つかりませんでした');
  });

  it('観察記録を取得できること', async () => {
    (getUserSession as jest.Mock).mockResolvedValue(mockSession);
    (createClient as jest.Mock).mockResolvedValue(
      buildSupabaseMock({
        observationResult: {
          data: {
            id: 'obs-id',
            child_id: 'child-id',
            observation_date: '2025-01-02',
            content: 'テスト内容',
            created_by: 'user-id',
            created_at: '2025-01-02T10:00:00Z',
            updated_at: '2025-01-02T11:00:00Z',
            m_children: {
              family_name: '田中',
              given_name: '太郎',
              nickname: 'たろう',
              facility_id: 'test-facility-id',
            },
            record_tags: [],
          },
          error: null,
        },
        createdByResult: {
          data: { name: '山田先生' },
          error: null,
        },
        recentResult: { data: [], error: null },
      }),
    );

    const request = new NextRequest('http://localhost:3000/api/records/personal/obs-id', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ id: 'obs-id' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.child_name).toBe('たろう');
    expect(data.data.created_by).toBe('user-id');
    expect(data.data.created_by_name).toBe('山田先生');
  });
});
