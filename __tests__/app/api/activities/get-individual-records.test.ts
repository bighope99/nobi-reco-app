/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/activities/route';

// モック
jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

describe('/api/activities GET - individual_records機能', () => {
  const mockSession = {
    user_id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'staff' as const,
    company_id: 'test-company-id',
    company_name: 'Test Company',
    facilities: [
      {
        facility_id: 'test-facility-id',
        facility_name: 'Test Facility',
        is_primary: true,
      },
    ],
    current_facility_id: 'test-facility-id',
    classes: [],
  };

  const mockActivities = [
    {
      id: 'activity-1',
      facility_id: 'test-facility-id',
      activity_date: '2026-01-09',
      title: 'テスト活動1',
      content: '今日は公園で遊びました',
      snack: 'りんご',
      photos: null,
      class_id: 'class-1',
      mentioned_children: [],
      created_at: '2026-01-09T10:00:00Z',
      updated_at: '2026-01-09T10:00:00Z',
      m_classes: { id: 'class-1', name: 'ひまわり組' },
      m_users: { id: 'test-user-id', name: 'Test User' },
    },
    {
      id: 'activity-2',
      facility_id: 'test-facility-id',
      activity_date: '2026-01-08',
      title: 'テスト活動2',
      content: '室内で工作をしました',
      snack: 'クッキー',
      photos: null,
      class_id: 'class-1',
      mentioned_children: [],
      created_at: '2026-01-08T10:00:00Z',
      updated_at: '2026-01-08T10:00:00Z',
      m_classes: { id: 'class-1', name: 'ひまわり組' },
      m_users: { id: 'test-user-id', name: 'Test User' },
    },
  ];

  const mockObservations = [
    {
      id: 'obs-1',
      activity_id: 'activity-1',
      child_id: 'child-1',
      m_children: {
        family_name: '田中',
        given_name: '太郎',
        nickname: 'たろう',
      },
    },
    {
      id: 'obs-2',
      activity_id: 'activity-1',
      child_id: 'child-2',
      m_children: {
        family_name: '佐藤',
        given_name: '花子',
        nickname: null,
      },
    },
    {
      id: 'obs-3',
      activity_id: 'activity-2',
      child_id: 'child-3',
      m_children: {
        family_name: '鈴木',
        given_name: '次郎',
        nickname: 'じろう',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('個別記録情報の取得', () => {
    it('活動記録に紐づく個別記録をindividual_recordsとして返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
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
                data: mockActivities,
                error: null,
                count: mockActivities.length,
              }),
            };
          }
          if (tableName === 'r_observation') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              is: jest.fn().mockResolvedValue({
                data: mockObservations,
                error: null,
              }),
            };
          }
          return mockSupabase;
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.activities).toHaveLength(2);

      // activity-1の個別記録を確認
      const activity1 = data.data.activities.find((a: any) => a.activity_id === 'activity-1');
      expect(activity1.individual_records).toHaveLength(2);
      expect(activity1.individual_records[0]).toEqual({
        observation_id: 'obs-1',
        child_id: 'child-1',
        child_name: 'たろう', // nicknameを優先
      });
      expect(activity1.individual_records[1]).toEqual({
        observation_id: 'obs-2',
        child_id: 'child-2',
        child_name: '佐藤 花子', // nicknameがない場合は姓名
      });

      // activity-2の個別記録を確認
      const activity2 = data.data.activities.find((a: any) => a.activity_id === 'activity-2');
      expect(activity2.individual_records).toHaveLength(1);
      expect(activity2.individual_records[0]).toEqual({
        observation_id: 'obs-3',
        child_id: 'child-3',
        child_name: 'じろう',
      });
    });

    it('個別記録がない活動記録は空配列を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
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
                data: mockActivities,
                error: null,
                count: mockActivities.length,
              }),
            };
          }
          if (tableName === 'r_observation') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              is: jest.fn().mockResolvedValue({
                data: [], // 個別記録なし
                error: null,
              }),
            };
          }
          return mockSupabase;
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.activities).toHaveLength(2);
      data.data.activities.forEach((activity: any) => {
        expect(activity.individual_records).toEqual([]);
        expect(activity.individual_record_count).toBe(0);
      });
    });

    it('individual_record_countとindividual_recordsの件数が一致すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
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
                data: mockActivities,
                error: null,
                count: mockActivities.length,
              }),
            };
          }
          if (tableName === 'r_observation') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              is: jest.fn().mockResolvedValue({
                data: mockObservations,
                error: null,
              }),
            };
          }
          return mockSupabase;
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      data.data.activities.forEach((activity: any) => {
        expect(activity.individual_record_count).toBe(activity.individual_records.length);
      });
    });
  });

  describe('子ども名の表示ロジック', () => {
    it('nicknameがある場合はnicknameを使用すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
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
                data: [mockActivities[0]],
                error: null,
                count: 1,
              }),
            };
          }
          if (tableName === 'r_observation') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              is: jest.fn().mockResolvedValue({
                data: [mockObservations[0]], // nicknameあり
                error: null,
              }),
            };
          }
          return mockSupabase;
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.activities[0].individual_records[0].child_name).toBe('たろう');
    });

    it('nicknameがない場合は姓名を使用すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
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
                data: [mockActivities[0]],
                error: null,
                count: 1,
              }),
            };
          }
          if (tableName === 'r_observation') {
            return {
              select: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
              is: jest.fn().mockResolvedValue({
                data: [mockObservations[1]], // nicknameなし
                error: null,
              }),
            };
          }
          return mockSupabase;
        }),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/activities?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.activities[0].individual_records[0].child_name).toBe('佐藤 花子');
    });
  });
});
