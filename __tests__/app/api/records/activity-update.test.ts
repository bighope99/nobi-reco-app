/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/records/activity/route';

// モック
jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/activity PUT', () => {
  const mockMetadata = {
    user_id: 'test-user-id',
    role: 'staff' as const,
    company_id: 'test-company-id',
    current_facility_id: 'test-facility-id',
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
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(mockMetadata);
  });

  describe('認証テスト', () => {
    it('認証されていない場合は401を返すこと', async () => {
      (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(null);

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
      const mockSupabase: Record<string, unknown> = {};
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
      const mockSupabase: Record<string, unknown> = {};
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

  describe('保育日誌更新', () => {
    it('保育日誌を正しく更新できること', async () => {
      let updatedData: any = null;
      const mockSupabase: Record<string, unknown> = {
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: mockMetadata.current_facility_id,
                  created_by: mockMetadata.user_id,
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

    it('存在しない保育日誌の更新時は404を返すこと', async () => {
      const mockSupabase: Record<string, unknown> = {
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

    it('他の施設の保育日誌を更新できないこと', async () => {
      const mockSupabase: Record<string, unknown> = {
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
                  created_by: mockMetadata.user_id,
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
      let updatedData: any = null;
      const mockSupabase: Record<string, unknown> = {
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: mockMetadata.current_facility_id,
                  created_by: mockMetadata.user_id,
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
      const mockSupabase: Record<string, unknown> = {
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUpdateData.activity_id,
                  facility_id: mockMetadata.current_facility_id,
                  created_by: mockMetadata.user_id,
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
