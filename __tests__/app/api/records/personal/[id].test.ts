/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/records/personal/[id]/route';

// Mock dependencies
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/crypto/decryption-helper', () => ({
  decryptOrFallback: jest.fn((val: string) => val), // Pass through by default
  formatName: jest.fn((family: string, given: string) => `${family} ${given}`),
}));

import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

/**
 * Supabase Mock Builder for GET /api/records/personal/[id]
 */
const createGetSupabaseMock = (options: {
  observationData?: any;
  observationError?: any;
  createdByUser?: any;
  recentObservations?: any[];
  recentObservationsError?: any;
  recentTags?: any[];
  recentTagsError?: any;
}) => {
  const {
    observationData = null,
    observationError = null,
    createdByUser = { name: 'John Doe' },
    recentObservations = [],
    recentObservationsError = null,
    recentTags = [],
    recentTagsError = null,
  } = options;

  // Track number of times from('r_observation') is called
  let observationCallCount = 0;

  return {
    from: jest.fn((table: string) => {
      switch (table) {
        case 'r_observation':
          observationCallCount++;
          if (observationCallCount === 1) {
            // First call: fetch observation detail
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: observationData,
                      error: observationError,
                    }),
                  }),
                }),
              }),
            };
          } else {
            // Second call: fetch recent observations
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  is: jest.fn().mockReturnValue({
                    neq: jest.fn().mockReturnValue({
                      order: jest.fn().mockReturnValue({
                        order: jest.fn().mockReturnValue({
                          limit: jest.fn().mockResolvedValue({
                            data: recentObservations,
                            error: recentObservationsError,
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
        case 'm_users':
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: createdByUser,
                  error: null,
                }),
              }),
            }),
          };
        case '_record_tag':
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: recentTags,
                error: recentTagsError,
              }),
            }),
          };
        default:
          return {};
      }
    }),
  };
};

/**
 * Supabase Mock Builder for PATCH /api/records/personal/[id]
 */
const createPatchSupabaseMock = (options: {
  existingData?: any;
  fetchError?: any;
  updateData?: any;
  updateError?: any;
}) => {
  const {
    existingData = null,
    fetchError = null,
    updateData = null,
    updateError = null,
  } = options;

  const existingSelect = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      is: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: existingData,
          error: fetchError,
        }),
      }),
    }),
  });

  const updateMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: updateData,
          error: updateError,
        }),
      }),
    }),
  });

  return {
    from: jest.fn((table: string) => {
      if (table === 'r_observation') {
        return { select: existingSelect, update: updateMock };
      }
      return {};
    }),
    __updateMock: updateMock,
  };
};

describe('GET /api/records/personal/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('should return observation record with recent observations', async () => {
      const observationData = {
        id: 'obs-1',
        child_id: 'child-1',
        observation_date: '2024-01-15',
        content: 'Test observation content',
        objective: 'Objective note',
        subjective: 'Subjective note',
        created_by: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        m_children: {
          facility_id: 'facility-1',
          family_name: 'Yamada',
          given_name: 'Taro',
          nickname: null,
        },
        record_tags: [{ tag_id: 'tag-1' }, { tag_id: 'tag-2' }],
      };

      const recentObservations = [
        {
          id: 'obs-2',
          observation_date: '2024-01-10',
          content: 'Previous observation',
          created_at: '2024-01-10T10:00:00Z',
          record_tags: [{ tag_id: 'tag-1' }],
        },
      ];

      const supabase = createGetSupabaseMock({
        observationData,
        recentObservations,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('obs-1');
      expect(json.data.content).toBe('Test observation content');
      expect(json.data.observation_date).toBe('2024-01-15');
      expect(json.data.tag_flags).toEqual({ 'tag-1': true, 'tag-2': true });
      expect(json.data.recent_observations).toHaveLength(1);
      expect(json.data.recent_observations[0].id).toBe('obs-2');
    });

    it('should handle child name from nickname', async () => {
      const observationData = {
        id: 'obs-1',
        child_id: 'child-1',
        observation_date: '2024-01-15',
        content: 'Test observation content',
        objective: null,
        subjective: null,
        created_by: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        m_children: {
          facility_id: 'facility-1',
          family_name: 'Yamada',
          given_name: 'Taro',
          nickname: 'Ta-chan',
        },
        record_tags: [],
      };

      const supabase = createGetSupabaseMock({
        observationData,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.child_name).toBe('Ta-chan');
    });

    it('should handle empty recent observations', async () => {
      const observationData = {
        id: 'obs-1',
        child_id: 'child-1',
        observation_date: '2024-01-15',
        content: 'Test observation content',
        objective: null,
        subjective: null,
        created_by: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        m_children: {
          facility_id: 'facility-1',
          family_name: 'Yamada',
          given_name: 'Taro',
          nickname: null,
        },
        record_tags: [],
      };

      const supabase = createGetSupabaseMock({
        observationData,
        recentObservations: [],
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.recent_observations).toEqual([]);
    });
  });

  describe('認証エラー', () => {
    it('should return 401 when metadata is null', async () => {
      const supabase = createGetSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 403 when current_facility_id is null', async () => {
      const supabase = createGetSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: null,
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });
  });

  describe('権限エラー', () => {
    it('should return 403 when observation belongs to different facility', async () => {
      const observationData = {
        id: 'obs-1',
        child_id: 'child-1',
        observation_date: '2024-01-15',
        content: 'Test observation content',
        objective: null,
        subjective: null,
        created_by: 'user-2',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        m_children: {
          facility_id: 'facility-2', // Different facility
          family_name: 'Yamada',
          given_name: 'Taro',
          nickname: null,
        },
        record_tags: [],
      };

      const supabase = createGetSupabaseMock({ observationData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });

    it('should return 403 when m_children is null', async () => {
      const observationData = {
        id: 'obs-1',
        child_id: 'child-1',
        observation_date: '2024-01-15',
        content: 'Test observation content',
        objective: null,
        subjective: null,
        created_by: 'user-1',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        m_children: null,
        record_tags: [],
      };

      const supabase = createGetSupabaseMock({ observationData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
    });
  });

  describe('存在しない記録', () => {
    it('should return 404 when observation not found', async () => {
      const supabase = createGetSupabaseMock({
        observationData: null,
        observationError: { code: 'PGRST116', message: 'Not found' },
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-999');
      const params = Promise.resolve({ id: 'obs-999' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('データが見つかりませんでした');
    });

    it('should return 404 when data is null (deleted)', async () => {
      const supabase = createGetSupabaseMock({
        observationData: null,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-deleted');
      const params = Promise.resolve({ id: 'obs-deleted' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    it('should return 500 on unexpected error', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/records/personal/obs-1');
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await GET(request, { params });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Internal server error');
    });
  });
});

describe('PATCH /api/records/personal/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('should update content and observation_date', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: {
          facility_id: 'facility-1',
        },
      };

      const updateData = {
        id: 'obs-1',
        content: 'Updated content',
        observation_date: '2024-01-20',
        updated_at: '2024-01-20T12:00:00Z',
      };

      const supabase = createPatchSupabaseMock({
        existingData,
        updateData,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
          observation_date: '2024-01-20',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.content).toBe('Updated content');
      expect(json.data.observation_date).toBe('2024-01-20');

      // Verify update was called with correct data
      expect(supabase.__updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Updated content',
          observation_date: '2024-01-20',
          updated_by: 'user-1',
        })
      );
    });

    it('should update only content when observation_date is not provided', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: {
          facility_id: 'facility-1',
        },
      };

      const updateData = {
        id: 'obs-1',
        content: 'Updated content only',
        observation_date: '2024-01-15',
        updated_at: '2024-01-20T12:00:00Z',
      };

      const supabase = createPatchSupabaseMock({
        existingData,
        updateData,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content only',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify observation_date was NOT included in update
      expect(supabase.__updateMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          observation_date: expect.anything(),
        })
      );
    });

    it('should trim whitespace from content and date', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: {
          facility_id: 'facility-1',
        },
      };

      const updateData = {
        id: 'obs-1',
        content: 'Trimmed content',
        observation_date: '2024-01-20',
        updated_at: '2024-01-20T12:00:00Z',
      };

      const supabase = createPatchSupabaseMock({
        existingData,
        updateData,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: '  Trimmed content  ',
          observation_date: '  2024-01-20  ',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(supabase.__updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Trimmed content',
          observation_date: '2024-01-20',
        })
      );
    });
  });

  describe('バリデーションエラー', () => {
    it('should return 400 when content is empty', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: '',
          observation_date: '2024-01-20',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('本文を入力してください');
    });

    it('should return 400 when content is only whitespace', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: '   ',
          observation_date: '2024-01-20',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('本文を入力してください');
    });

    it('should return 400 when observation_date format is invalid', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Valid content',
          observation_date: '2024/01/20', // Invalid format
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('日付形式が不正です');
    });

    it('should return 400 for various invalid date formats', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const invalidFormats = [
        '20240120',     // No separators
        '2024-1-20',    // Missing leading zero
        '2024-01-2',    // Missing leading zero
        '24-01-20',     // 2-digit year
        'invalid',      // Not a date
      ];

      for (const invalidDate of invalidFormats) {
        const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
          method: 'PATCH',
          body: JSON.stringify({
            content: 'Valid content',
            observation_date: invalidDate,
          }),
        });
        const params = Promise.resolve({ id: 'obs-1' });

        const response = await PATCH(request, { params });
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('日付形式が不正です');
      }
    });

    it('should return 400 when date is not a real date (2024-02-30)', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Valid content',
          observation_date: '2024-02-30', // February doesn't have 30 days
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('無効な日付です');
    });

    it('should return 400 when date is not a real date (2024-13-01)', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Valid content',
          observation_date: '2024-13-01', // Month 13 doesn't exist
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('無効な日付です');
    });

    it('should return 400 when date is not a real date (2024-01-32)', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Valid content',
          observation_date: '2024-01-32', // January only has 31 days
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('無効な日付です');
    });

    it('should accept valid leap year date (2024-02-29)', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: {
          facility_id: 'facility-1',
        },
      };

      const updateData = {
        id: 'obs-1',
        content: 'Valid content',
        observation_date: '2024-02-29',
        updated_at: '2024-01-20T12:00:00Z',
      };

      const supabase = createPatchSupabaseMock({
        existingData,
        updateData,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Valid content',
          observation_date: '2024-02-29',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('認証エラー', () => {
    it('should return 401 when metadata is null', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Test content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 403 when current_facility_id is null', async () => {
      const supabase = createPatchSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: null,
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Test content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });
  });

  describe('権限エラー', () => {
    it('should return 403 when observation belongs to different facility', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: {
          facility_id: 'facility-2', // Different facility
        },
      };

      const supabase = createPatchSupabaseMock({ existingData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Forbidden');
    });

    it('should return 403 when m_children is null', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: null,
      };

      const supabase = createPatchSupabaseMock({ existingData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
    });

    it('should handle m_children as array and check facility_id', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: [{ facility_id: 'facility-2' }], // Array format with different facility
      };

      const supabase = createPatchSupabaseMock({ existingData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
    });
  });

  describe('存在しない記録', () => {
    it('should return 404 when observation not found', async () => {
      const supabase = createPatchSupabaseMock({
        existingData: null,
        fetchError: { code: 'PGRST116', message: 'Not found' },
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-999', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-999' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Not found');
    });

    it('should return 404 when data is null (deleted)', async () => {
      const supabase = createPatchSupabaseMock({
        existingData: null,
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-deleted', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-deleted' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('更新エラー', () => {
    it('should return 500 when update fails', async () => {
      const existingData = {
        id: 'obs-1',
        child_id: 'child-1',
        m_children: {
          facility_id: 'facility-1',
        },
      };

      const supabase = createPatchSupabaseMock({
        existingData,
        updateData: null,
        updateError: { message: 'Update failed' },
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('更新に失敗しました');
    });

    it('should return 500 on unexpected error', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/records/personal/obs-1', {
        method: 'PATCH',
        body: JSON.stringify({
          content: 'Updated content',
        }),
      });
      const params = Promise.resolve({ id: 'obs-1' });

      const response = await PATCH(request, { params });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Internal server error');
    });
  });
});
