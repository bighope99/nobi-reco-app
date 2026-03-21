/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/children/[id]/summary/route';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/crypto/decryption-helper', () => ({
  decryptOrFallback: jest.fn((val: string) => val),
  formatName: jest.fn((parts: string[]) => parts.filter(Boolean).join(' ')),
}));

// Mock LangChain to avoid unnecessary API calls during tests
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mock AI response' }),
  })),
}));

jest.mock('@langchain/core/prompts', () => ({
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue({ content: 'Mock AI response' }),
      }),
    }),
  },
}));

import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
  typeof getAuthenticatedUserMetadata
>;

/**
 * Supabase Mock Builder for GET /api/children/[id]/summary
 */
const createSupabaseMock = (options: {
  childData?: any;
  childError?: any;
  observationsData?: any[];
  observationsError?: any;
  attendanceData?: any[];
  attendanceError?: any;
}) => {
  const {
    childData = null,
    childError = null,
    observationsData = [],
    observationsError = null,
    attendanceData = [],
    attendanceError = null,
  } = options;

  let callCount = 0;

  return {
    from: jest.fn((table: string) => {
      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: childData,
                      error: childError,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'r_observation') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  is: jest.fn().mockReturnValue({
                    order: jest.fn().mockResolvedValue({
                      data: observationsData,
                      error: observationsError,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'h_attendance') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    is: jest.fn().mockResolvedValue({
                      data: attendanceData,
                      error: attendanceError,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      return {};
    }),
  };
};

describe('GET /api/children/[id]/summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('should return 200 for child WITHOUT class (_child_class: [])', async () => {
      const childData = {
        id: 'child-1',
        family_name: 'Yamada',
        given_name: 'Taro',
        family_name_kana: 'ヤマダ',
        given_name_kana: 'タロウ',
        birth_date: '2018-04-01',
        photo_url: null,
        _child_class: [], // クラス未所属
      };

      const supabase = createSupabaseMock({
        childData,
        observationsData: [],
        attendanceData: [],
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-1/summary');
      const params = Promise.resolve({ id: 'child-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.child_info).toMatchObject({
        child_id: 'child-1',
        name: 'Yamada Taro',
        class_name: '', // クラス未所属なので空文字列
      });
    });

    it('should return 200 for child WITH class assignment', async () => {
      const childData = {
        id: 'child-2',
        family_name: 'Suzuki',
        given_name: 'Hanako',
        family_name_kana: 'スズキ',
        given_name_kana: 'ハナコ',
        birth_date: '2019-05-15',
        photo_url: null,
        _child_class: [
          {
            m_classes: {
              id: 'class-1',
              name: 'ひまわり組',
            },
          },
        ],
      };

      const supabase = createSupabaseMock({
        childData,
        observationsData: [],
        attendanceData: [],
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-2/summary');
      const params = Promise.resolve({ id: 'child-2' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.child_info).toMatchObject({
        child_id: 'child-2',
        name: 'Suzuki Hanako',
        class_name: 'ひまわり組', // クラス所属の場合はクラス名が返る
      });
    });

    it('should calculate statistics with observations and attendance', async () => {
      const childData = {
        id: 'child-3',
        family_name: 'Tanaka',
        given_name: 'Ichiro',
        family_name_kana: 'タナカ',
        given_name_kana: 'イチロウ',
        birth_date: '2017-03-20',
        photo_url: null,
        _child_class: [],
      };

      const observationsData = [
        {
          id: 'obs-1',
          recorded_at: '2024-01-15T10:00:00Z',
          content: 'Test observation 1',
        },
        {
          id: 'obs-2',
          recorded_at: '2024-01-10T10:00:00Z',
          content: 'Test observation 2',
        },
      ];

      const attendanceData = [
        {
          id: 'att-1',
          attendance_date: '2024-01-15',
          checked_in_at: '2024-01-15T08:00:00Z',
        },
        {
          id: 'att-2',
          attendance_date: '2024-01-14',
          checked_in_at: '2024-01-14T08:00:00Z',
        },
      ];

      const supabase = createSupabaseMock({
        childData,
        observationsData,
        attendanceData,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-3/summary');
      const params = Promise.resolve({ id: 'child-3' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.overall.total_observations).toBe(2);
      expect(json.data.recent_observations).toHaveLength(2);
    });

    it('should handle empty class_name when _child_class is undefined', async () => {
      const childData = {
        id: 'child-4',
        family_name: 'Nakamura',
        given_name: 'Kenji',
        family_name_kana: 'ナカムラ',
        given_name_kana: 'ケンジ',
        birth_date: '2020-08-01',
        photo_url: null,
        // _child_class が存在しない場合
      };

      const supabase = createSupabaseMock({
        childData,
        observationsData: [],
        attendanceData: [],
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-4/summary');
      const params = Promise.resolve({ id: 'child-4' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.child_info.class_name).toBe('');
    });
  });

  describe('認証エラー', () => {
    it('should return 401 when metadata is null', async () => {
      const supabase = createSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/children/child-1/summary');
      const params = Promise.resolve({ id: 'child-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 404 when current_facility_id is null', async () => {
      const supabase = createSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: null,
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-1/summary');
      const params = Promise.resolve({ id: 'child-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Facility not found');
    });
  });

  describe('存在しない子供', () => {
    it('should return 404 when child not found', async () => {
      const supabase = createSupabaseMock({
        childData: null,
        childError: { code: 'PGRST116', message: 'Not found' },
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-999/summary');
      const params = Promise.resolve({ id: 'child-999' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Child not found');
    });

    it('should return 404 when data is null (deleted)', async () => {
      const supabase = createSupabaseMock({
        childData: null,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-deleted/summary');
      const params = Promise.resolve({ id: 'child-deleted' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    it('should return 500 on unexpected error', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/children/child-1/summary');
      const params = Promise.resolve({ id: 'child-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Internal server error');
    });

    it('should handle observation query errors gracefully', async () => {
      const childData = {
        id: 'child-1',
        family_name: 'Test',
        given_name: 'User',
        family_name_kana: 'テスト',
        given_name_kana: 'ユーザー',
        birth_date: '2018-01-01',
        photo_url: null,
        _child_class: [],
      };

      const supabase = createSupabaseMock({
        childData,
        observationsData: null as unknown as any[],
        observationsError: { message: 'Query error' },
        attendanceData: [],
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        role: 'staff',
        current_facility_id: 'facility-1',
        company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/child-1/summary');
      const params = Promise.resolve({ id: 'child-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      // Should still succeed but with 0 observations
      expect(response.status).toBe(200);
      expect(json.data.overall.total_observations).toBe(0);
    });
  });
});
