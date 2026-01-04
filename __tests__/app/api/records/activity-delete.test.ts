/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/records/activity/route';

jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/activity DELETE', () => {
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

  const mockDeleteData = {
    activity_id: 'test-activity-id-123',
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
        method: 'DELETE',
        body: JSON.stringify(mockDeleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('活動記録削除', () => {
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

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'DELETE',
        body: JSON.stringify({}),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('activity_id');
    });
  });

  describe('活動記録が見つからない場合', () => {
    it('404を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase: any = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string): any => {
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
        method: 'DELETE',
        body: JSON.stringify(mockDeleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('活動記録が見つかりませんでした');
    });

    it('403を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase: any = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string): any => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockDeleteData.activity_id,
                  facility_id: 'other-facility-id',
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
        method: 'DELETE',
        body: JSON.stringify(mockDeleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('この活動記録を削除する権限がありません');
    });

    it('200を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      let updatedData: any = null;
      const mockSupabase: any = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string): any => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockDeleteData.activity_id,
                  facility_id: mockSession.current_facility_id,
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
                      id: mockDeleteData.activity_id,
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
        method: 'DELETE',
        body: JSON.stringify(mockDeleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(updatedData).toBeDefined();
      expect(updatedData.deleted_at).toBeDefined();
    });
  });

  describe('削除に失敗した場合', () => {
    it('500を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase: any = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string): any => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockDeleteData.activity_id,
                  facility_id: mockSession.current_facility_id,
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
        method: 'DELETE',
        body: JSON.stringify(mockDeleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
