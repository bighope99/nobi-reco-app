/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/records/activity/route';

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/activity DELETE', () => {
  const mockMetadata = {
    user_id: 'test-user-id',
    role: 'staff' as const,
    company_id: 'test-company-id',
    current_facility_id: 'test-facility-id',
  };

  const mockDeleteData = {
    activity_id: 'test-activity-id-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(mockMetadata);
  });

  describe('認証テスト', () => {
    it('認証されていない場合は401を返すこと', async () => {
      (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(null);

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

  describe('保育日誌削除', () => {
    it('activity_idが必須であること', async () => {
      const mockSupabase = {};
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

  describe('保育日誌が見つからない場合', () => {
    it('404を返すこと', async () => {
      const mockSupabase: any = {
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
      expect(data.error).toContain('保育日誌が見つかりませんでした');
    });

    it('403を返すこと', async () => {
      const mockSupabase: any = {
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
      expect(data.error).toContain('この保育日誌を削除する権限がありません');
    });

    it('200を返すこと', async () => {
      let updatedData: any = null;
      const mockSupabase: any = {
        from: jest.fn((tableName: string): any => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockDeleteData.activity_id,
                  facility_id: mockMetadata.current_facility_id,
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
      const mockSupabase: any = {
        from: jest.fn((tableName: string): any => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockDeleteData.activity_id,
                  facility_id: mockMetadata.current_facility_id,
                },
                error: null,
              }),
              update: jest.fn(() => ({
                eq: jest.fn().mockResolvedValue({
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
