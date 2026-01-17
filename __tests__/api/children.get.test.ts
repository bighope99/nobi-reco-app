import { NextRequest } from 'next/server';
import { GET } from '@/app/api/children/route';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/pii/searchIndex', () => ({
  searchByName: jest.fn(),
}));

jest.mock('@/utils/crypto/decryption-helper', () => ({
  decryptOrFallback: (value: string | null | undefined) => value || null,
  formatName: (parts: Array<string | null | undefined>, emptyValue: string | null = null) => {
    const cleaned = parts
      .map(part => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(' ') : emptyValue;
  },
}));

const buildRequest = (queryParams?: Record<string, string>) => {
  const url = new URL('http://localhost/api/children');
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new NextRequest(url.toString());
};

describe('GET /api/children', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetUserSession = getUserSession as jest.MockedFunction<typeof getUserSession>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: { message: 'No session' },
          }),
        },
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 401 when session is null', async () => {
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('Facility Validation', () => {
    it('should return 404 when user has no current_facility_id', async () => {
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [],
        current_facility_id: null,
        classes: [],
      });

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Facility not found');
    });

    it('should return 404 when userSession is null', async () => {
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue(null);

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Facility not found');
    });
  });

  describe('Success Cases', () => {
    it('should return children list with basic data structure', async () => {
      const mockChildren = [
        {
          id: 'child-1',
          family_name: '山田',
          given_name: '太郎',
          family_name_kana: 'ヤマダ',
          given_name_kana: 'タロウ',
          gender: 'male',
          birth_date: '2018-04-01',
          grade_add: 0,
          photo_url: null,
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          parent_phone: '090-1234-5678',
          parent_email: 'yamada@example.com',
          allergies: null,
          photo_permission_public: true,
          report_name_permission: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          _child_class: [
            {
              class_id: 'class-1',
              is_current: true,
              m_classes: {
                id: 'class-1',
                name: 'ひまわり組',
                age_group: 'elementary',
              },
            },
          ],
          _child_guardian: [],
        },
      ];

      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: mockChildren,
          error: null,
          count: 1,
        }),
      };

      const summaryQuery: any = {
        select: jest.fn(() => summaryQuery),
        eq: jest.fn(() => summaryQuery),
        is: jest.fn().mockResolvedValue({
          data: [{ enrollment_status: 'enrolled', allergies: null }],
          error: null,
        }),
      };

      const classesQuery: any = {
        select: jest.fn(() => classesQuery),
        eq: jest.fn(() => classesQuery),
        is: jest.fn(() => classesQuery),
        order: jest.fn().mockResolvedValue({
          data: [{ id: 'class-1', name: 'ひまわり組' }],
          error: null,
        }),
      };

      const classChildrenQuery: any = {
        select: jest.fn(() => classChildrenQuery),
        eq: jest.fn(() => classChildrenQuery),
        in: jest.fn().mockResolvedValue({
          data: [{ class_id: 'class-1', child_id: 'child-1' }],
          error: null,
        }),
      };

      const siblingsQuery: any = {
        select: jest.fn(() => siblingsQuery),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      let callCount = 0;
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn((table: string) => {
          callCount++;
          if (table === 'm_children' && callCount === 1) return childrenQuery;
          if (table === '_child_sibling') return siblingsQuery;
          if (table === 'm_children' && callCount === 3) return summaryQuery;
          if (table === 'm_classes') return classesQuery;
          if (table === '_child_class') return classChildrenQuery;
          throw new Error(`Unexpected table: ${table} (call ${callCount})`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.children).toHaveLength(1);
      expect(json.data.children[0]).toMatchObject({
        child_id: 'child-1',
        name: expect.any(String),
        class_name: 'ひまわり組',
      });
    });

    it('should return empty array when no children exist', async () => {
      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => childrenQuery),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.children).toEqual([]);
      expect(json.data.total).toBe(0);
    });

    it('should handle children without class assignments', async () => {
      const mockChildren = [
        {
          id: 'child-2',
          family_name: '佐藤',
          given_name: '花子',
          family_name_kana: 'サトウ',
          given_name_kana: 'ハナコ',
          gender: 'female',
          birth_date: '2019-05-15',
          grade_add: 0,
          photo_url: null,
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          parent_phone: null,
          parent_email: null,
          allergies: null,
          photo_permission_public: false,
          report_name_permission: false,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          _child_class: [],
          _child_guardian: [],
        },
      ];

      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: mockChildren,
          error: null,
          count: 1,
        }),
      };

      const summaryQuery: any = {
        select: jest.fn(() => summaryQuery),
        eq: jest.fn(() => summaryQuery),
        is: jest.fn().mockResolvedValue({
          data: [{ enrollment_status: 'enrolled', allergies: null }],
          error: null,
        }),
      };

      const classesQuery: any = {
        select: jest.fn(() => classesQuery),
        eq: jest.fn(() => classesQuery),
        is: jest.fn(() => classesQuery),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const classChildrenQuery: any = {
        select: jest.fn(() => classChildrenQuery),
        eq: jest.fn(() => classChildrenQuery),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const siblingsQuery: any = {
        select: jest.fn(() => siblingsQuery),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      let callCount = 0;
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn((table: string) => {
          callCount++;
          if (table === 'm_children' && callCount === 1) return childrenQuery;
          if (table === '_child_sibling') return siblingsQuery;
          if (table === 'm_children' && callCount === 3) return summaryQuery;
          if (table === 'm_classes') return classesQuery;
          if (table === '_child_class') return classChildrenQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.children).toHaveLength(1);
      expect(json.data.children[0].class_name).toBe('');
      expect(json.data.children[0].class_id).toBeNull();
    });
  });

  describe('Query Parameters', () => {
    it('should respect status=enrolled parameter', async () => {
      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => childrenQuery),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest({ status: 'enrolled' });
      await GET(request);

      expect(childrenQuery.eq).toHaveBeenCalledWith('enrollment_status', 'enrolled');
    });

    it('should respect limit parameter', async () => {
      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => childrenQuery),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest({ limit: '200' });
      await GET(request);

      expect(childrenQuery.range).toHaveBeenCalledWith(0, 199);
    });

    it('should use default sort_by=name and sort_order=asc', async () => {
      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => childrenQuery),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest();
      await GET(request);

      // sort_by='name' is converted to 'family_name_kana'
      expect(childrenQuery.order).toHaveBeenCalledWith('family_name_kana', { ascending: true });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database query fails', async () => {
      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => childrenQuery),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch children');
    });

    it('should return 500 when unexpected error occurs', async () => {
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockRejectedValue(new Error('Unexpected error')),
        },
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal Server Error');
    });
  });

  describe('Response Structure for observation-editor', () => {
    it('should match the expected response structure for observation-editor', async () => {
      const mockChildren = [
        {
          id: 'child-1',
          family_name: '田中',
          given_name: '一郎',
          family_name_kana: 'タナカ',
          given_name_kana: 'イチロウ',
          gender: 'male',
          birth_date: '2017-06-10',
          grade_add: 0,
          photo_url: null,
          enrollment_status: 'enrolled',
          enrollment_type: 'regular',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          withdrawn_at: null,
          parent_phone: null,
          parent_email: null,
          allergies: null,
          photo_permission_public: true,
          report_name_permission: true,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          _child_class: [
            {
              class_id: 'class-1',
              is_current: true,
              m_classes: {
                id: 'class-1',
                name: 'さくら組',
                age_group: 'elementary',
              },
            },
          ],
          _child_guardian: [],
        },
      ];

      const childrenQuery: any = {
        select: jest.fn(() => childrenQuery),
        eq: jest.fn(() => childrenQuery),
        is: jest.fn(() => childrenQuery),
        order: jest.fn(() => childrenQuery),
        range: jest.fn().mockResolvedValue({
          data: mockChildren,
          error: null,
          count: 1,
        }),
      };

      const summaryQuery: any = {
        select: jest.fn(() => summaryQuery),
        eq: jest.fn(() => summaryQuery),
        is: jest.fn().mockResolvedValue({
          data: [{ enrollment_status: 'enrolled', allergies: null }],
          error: null,
        }),
      };

      const classesQuery: any = {
        select: jest.fn(() => classesQuery),
        eq: jest.fn(() => classesQuery),
        is: jest.fn(() => classesQuery),
        order: jest.fn().mockResolvedValue({
          data: [{ id: 'class-1', name: 'さくら組' }],
          error: null,
        }),
      };

      const classChildrenQuery: any = {
        select: jest.fn(() => classChildrenQuery),
        eq: jest.fn(() => classChildrenQuery),
        in: jest.fn().mockResolvedValue({
          data: [{ class_id: 'class-1', child_id: 'child-1' }],
          error: null,
        }),
      };

      const siblingsQuery: any = {
        select: jest.fn(() => siblingsQuery),
        in: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      let callCount = 0;
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'user-1' },
              },
            },
            error: null,
          }),
        },
        from: jest.fn((table: string) => {
          callCount++;
          if (table === 'm_children' && callCount === 1) return childrenQuery;
          if (table === '_child_sibling') return siblingsQuery;
          if (table === 'm_children' && callCount === 3) return summaryQuery;
          if (table === 'm_classes') return classesQuery;
          if (table === '_child_class') return classChildrenQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);
      mockedGetUserSession.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'facility_admin',
        company_id: 'company-1',
        company_name: 'Test Company',
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Test Facility',
            is_primary: true,
          },
        ],
        current_facility_id: 'facility-1',
        classes: [],
      });

      const request = buildRequest({ status: 'enrolled', sort_by: 'name', sort_order: 'asc', limit: '200' });
      const response = await GET(request);
      const json = await response.json();

      // Validate response structure matches observation-editor expectations
      expect(response.status).toBe(200);
      expect(json).toHaveProperty('data');
      expect(json.data).toHaveProperty('children');
      expect(Array.isArray(json.data.children)).toBe(true);

      // Validate each child has required fields
      const child = json.data.children[0];
      expect(child).toHaveProperty('child_id');
      expect(child).toHaveProperty('name');
      expect(child).toHaveProperty('class_name');

      // Verify types
      expect(typeof child.child_id).toBe('string');
      expect(typeof child.name).toBe('string');
      expect(typeof child.class_name === 'string' || child.class_name === null).toBe(true);
    });
  });
});
