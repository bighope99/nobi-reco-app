/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/records/activity/route';

// モック
jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/activity PUT', () => {
  const mockSession = {
    user_id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'teacher' as const,
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

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockUpdateData = {
    activity_id: 'test-activity-id-123',
    activity_date: '2025-01-03',
    title: '更新されたタイトル',
    content: '更新された活動内容',
    mentioned_children: ['token1', 'token2'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('認証テスト', () => {
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

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(mockUpdateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('バリデーション', () => {
    it('activity_idが必須であること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const requestData = { ...mockUpdateData };
      delete (requestData as any).activity_id;

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(requestData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('activity_id');
    });

    it('activity_dateが必須であること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const requestData = { ...mockUpdateData };
      delete (requestData as any).activity_date;

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(requestData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('activity_date');
    });
  });

  describe('活動記録更新', () => {
    it('活動記録を正しく更新できること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      let updatedData: any = null;
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: mockSession.current_facility_id,
                  created_by: mockSession.user_id,
                },
                error: null,
              }),
              update: jest.fn((data) => {
                updatedData = data;
                return {
                  eq: jest.fn().mockReturnThis(),
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: mockUpdateData.activity_id,
                      ...data,
                    },
                    error: null,
                  }),
                };
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(mockUpdateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(updatedData).toBeDefined();
      expect(updatedData.title).toBe(mockUpdateData.title);
      expect(updatedData.content).toBe(mockUpdateData.content);
      expect(updatedData.mentioned_children).toEqual(mockUpdateData.mentioned_children);
    });

    it('存在しない活動記録の更新時は404を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(mockUpdateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('見つかりません');
    });

    it('他の施設の活動記録を更新できないこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: 'other-facility-id', // 異なる施設ID
                  created_by: mockSession.user_id,
                },
                error: null,
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(mockUpdateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('権限');
    });

    it('更新日時が自動的に設定されること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      let updatedData: any = null;
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: mockSession.current_facility_id,
                  created_by: mockSession.user_id,
                },
                error: null,
              }),
              update: jest.fn((data) => {
                updatedData = data;
                return {
                  eq: jest.fn().mockReturnThis(),
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: mockUpdateData.activity_id,
                      ...data,
                    },
                    error: null,
                  }),
                };
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(mockUpdateData),
      });

      const response = await PUT(request);

      expect(response.status).toBe(200);
      expect(updatedData).toBeDefined();
      expect(updatedData.updated_at).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    it('データベースエラー時は500を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: mockSession.current_facility_id,
                  created_by: mockSession.user_id,
                },
                error: null,
              }),
              update: jest.fn(() => ({
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(mockUpdateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
