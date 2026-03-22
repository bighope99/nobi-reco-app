/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/handover/route';

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { createClient } from '@/utils/supabase/server';

const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;
const mockCreateClient = createClient as jest.Mock;

describe('/api/handover GET', () => {
  const mockMetadata = {
    user_id: 'test-user-id',
    current_facility_id: 'test-facility-id',
    role: 'teacher' as const,
    company_id: 'test-company-id',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('認証エラー', () => {
    it('認証されていない場合は401を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);
      mockCreateClient.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026-03-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('current_facility_idがない場合は401を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        ...mockMetadata,
        current_facility_id: undefined,
      } as any);
      mockCreateClient.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026-03-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('バリデーションエラー', () => {
    it('dateパラメータ未指定で400を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);
      mockCreateClient.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/handover');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('date');
    });

    it('不正な日付形式で400を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);
      mockCreateClient.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026/03/01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('date format');
    });

    it('無効な日付値で400を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);
      mockCreateClient.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026-99-99');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid date');
    });

    it('不正なclass_id形式で400を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);
      mockCreateClient.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026-03-01&class_id=invalid-uuid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('class_id');
    });

    it('施設に所属しないclass_idで400を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase);

      const classId = '00000000-0000-0000-0000-000000000001';
      const request = new NextRequest(`http://localhost:3000/api/handover?date=2026-03-01&class_id=${classId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('class_id');
    });
  });

  describe('正常系', () => {
    it('データなしの場合は空配列を返す', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);

      const mockQuery: Record<string, jest.Mock> = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: { data: never[]; error: null }) => void) =>
          resolve({ data: [], error: null })
        ),
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      };
      mockCreateClient.mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026-03-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.handover_date).toBeNull();
      expect(data.data.items).toEqual([]);
    });

    it('正常にhandoverデータを取得できる', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);

      const mockActivities = [
        {
          id: 'activity-1',
          activity_date: '2026-02-28',
          handover: '明日は体育館を使います',
          handover_completed: false,
          class_id: 'class-1',
          m_classes: { id: 'class-1', name: 'ひまわり組' },
          m_users: { id: 'user-1', name: '山田太郎' },
        },
      ];

      const mockHandoverQuery: Record<string, jest.Mock> = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: { data: typeof mockActivities; error: null }) => void) =>
          resolve({ data: mockActivities, error: null })
        ),
      };

      // next record チェック用クエリモック
      const mockNextRecordQuery: Record<string, jest.Mock> = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({ count: 0, data: null, error: null }),
      };

      let fromCallCount = 0;
      const mockSupabase = {
        from: jest.fn().mockImplementation(() => {
          fromCallCount++;
          if (fromCallCount === 1) return mockHandoverQuery;
          return mockNextRecordQuery;
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/handover?date=2026-03-01');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.handover_date).toBe('2026-02-28');
      expect(data.data.has_next_record).toBe(false);
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0]).toEqual({
        activity_id: 'activity-1',
        handover: '明日は体育館を使います',
        handover_completed: false,
        class_name: 'ひまわり組',
        created_by_name: '山田太郎',
      });
    });

    it('class_idフィルタリングが正しく動作する', async () => {
      mockGetAuthenticatedUserMetadata.mockResolvedValue(mockMetadata);

      const classId = '00000000-0000-0000-0000-000000000001';
      let classIdFilterApplied = false;

      // m_classes check mock (facility check)
      const mockClassCheck = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: classId },
          error: null,
        }),
      };

      // activity query mock - needs to be thenable for await and chainable for .eq() after .limit()
      const mockActivityQuery: Record<string, jest.Mock> = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(function(this: any, col: string) {
          if (col === 'class_id') {
            classIdFilterApplied = true;
          }
          return this;
        }),
        is: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: { data: never[]; error: null }) => void) =>
          resolve({ data: [], error: null })
        ),
      };

      let fromCallCount = 0;
      const mockSupabase = {
        from: jest.fn().mockImplementation((table: string) => {
          fromCallCount++;
          if (table === 'm_classes') {
            return mockClassCheck;
          }
          return mockActivityQuery;
        }),
      };
      mockCreateClient.mockResolvedValue(mockSupabase);

      const request = new NextRequest(`http://localhost:3000/api/handover?date=2026-03-01&class_id=${classId}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(classIdFilterApplied).toBe(true);
    });
  });
});
