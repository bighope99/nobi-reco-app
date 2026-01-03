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

  describe('隱崎ｨｼ繝・せ繝・, () => {
    it('隱崎ｨｼ縺輔ｌ縺ｦ縺・↑縺・ｴ蜷医・401繧定ｿ斐☆縺薙→', async () => {
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

  describe('繝舌Μ繝・・繧ｷ繝ｧ繝ｳ', () => {
    it('activity_id縺悟ｿ・医〒縺ゅｋ縺薙→', async () => {
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

  describe('豢ｻ蜍戊ｨ倬鹸蜑企勁', () => {
    it('蟄伜惠縺励↑縺・ｴｻ蜍戊ｨ倬鹸縺ｮ蜑企勁譎ゅ・404繧定ｿ斐☆縺薙→', async () => {
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
        method: 'DELETE',
        body: JSON.stringify(mockDeleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('隕九▽縺九ｊ縺ｾ縺帙ｓ');
    });

    it('莉悶・譁ｽ險ｭ縺ｮ豢ｻ蜍戊ｨ倬鹸繧貞炎髯､縺ｧ縺阪↑縺・％縺ｨ', async () => {
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
      expect(data.error).toContain('讓ｩ髯');
    });

    it('豢ｻ蜍戊ｨ倬鹸繧貞炎髯､縺励∪縺励◆', async () => {
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

  describe('繧ｨ繝ｩ繝ｼ繝上Φ繝峨Μ繝ｳ繧ｰ', () => {
    it('繝・・繧ｿ繝吶・繧ｹ繧ｨ繝ｩ繝ｼ譎ゅ・500繧定ｿ斐☆縺薙→', async () => {
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
