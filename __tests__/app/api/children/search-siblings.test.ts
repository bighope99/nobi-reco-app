/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/children/search-siblings/route';

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

jest.mock('@/utils/pii/searchIndex', () => ({
  searchByPhone: jest.fn(),
}));

jest.mock('@/lib/children/import-csv', () => ({
  normalizePhone: jest.fn((phone: string) => phone.replace(/[-\s]/g, '')),
}));

import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { searchByPhone } from '@/utils/pii/searchIndex';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
  typeof getAuthenticatedUserMetadata
>;
const mockSearchByPhone = searchByPhone as jest.MockedFunction<typeof searchByPhone>;

/**
 * Supabase Mock Builder for POST /api/children/search-siblings
 */
const createSupabaseMock = (options: {
  childrenData?: any[];
  childrenError?: any;
}) => {
  const { childrenData = [], childrenError = null } = options;

  return {
    from: jest.fn((table: string) => {
      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  is: jest.fn().mockResolvedValue({
                    data: childrenData,
                    error: childrenError,
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

describe('POST /api/children/search-siblings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('should return children with class assignments (_child_class array)', async () => {
      const childrenData = [
        {
          id: 'child-1',
          family_name: 'Yamada',
          given_name: 'Taro',
          family_name_kana: 'ヤマダ',
          given_name_kana: 'タロウ',
          birth_date: '2018-04-01',
          enrollment_status: 'enrolled',
          photo_url: null,
          parent_phone: '09012345678',
          _child_class: [
            {
              is_current: true,
              m_classes: {
                id: 'class-1',
                name: 'ひまわり組',
                age_group: 'elementary',
              },
            },
          ],
        },
      ];

      const supabase = createSupabaseMock({ childrenData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });
      mockSearchByPhone.mockResolvedValue(['child-1']);

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1234-5678',
          child_id: null,
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.found).toBe(true);
      expect(json.data.candidates).toHaveLength(1);
      expect(json.data.candidates[0]).toMatchObject({
        child_id: 'child-1',
        name: 'Yamada Taro',
        class_name: 'ひまわり組',
        age_group: 'elementary',
      });
    });

    it('should return children WITHOUT class assignments (_child_class: [])', async () => {
      const childrenData = [
        {
          id: 'child-2',
          family_name: 'Suzuki',
          given_name: 'Hanako',
          family_name_kana: 'スズキ',
          given_name_kana: 'ハナコ',
          birth_date: '2019-05-15',
          enrollment_status: 'enrolled',
          photo_url: null,
          parent_phone: '09087654321',
          _child_class: [], // クラス未所属
        },
      ];

      const supabase = createSupabaseMock({ childrenData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });
      mockSearchByPhone.mockResolvedValue(['child-2']);

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-8765-4321',
          child_id: null,
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.found).toBe(true);
      expect(json.data.candidates).toHaveLength(1);
      expect(json.data.candidates[0]).toMatchObject({
        child_id: 'child-2',
        name: 'Suzuki Hanako',
        class_name: '', // クラス未所属なので空文字列
        age_group: '',
      });
    });

    it('should return MIXED cases (with and without class)', async () => {
      const childrenData = [
        {
          id: 'child-1',
          family_name: 'Tanaka',
          given_name: 'Ichiro',
          family_name_kana: 'タナカ',
          given_name_kana: 'イチロウ',
          birth_date: '2017-03-20',
          enrollment_status: 'enrolled',
          photo_url: null,
          parent_phone: '09012341111',
          _child_class: [
            {
              is_current: true,
              m_classes: {
                id: 'class-1',
                name: 'さくら組',
                age_group: 'elementary',
              },
            },
          ],
        },
        {
          id: 'child-2',
          family_name: 'Tanaka',
          given_name: 'Jiro',
          family_name_kana: 'タナカ',
          given_name_kana: 'ジロウ',
          birth_date: '2020-06-10',
          enrollment_status: 'enrolled',
          photo_url: null,
          parent_phone: '09012341111',
          _child_class: [], // クラス未所属
        },
      ];

      const supabase = createSupabaseMock({ childrenData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });
      mockSearchByPhone.mockResolvedValue(['child-1', 'child-2']);

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1234-1111',
          child_id: null,
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.found).toBe(true);
      expect(json.data.candidates).toHaveLength(2);

      // 1人目はクラスあり
      expect(json.data.candidates[0]).toMatchObject({
        child_id: 'child-1',
        class_name: 'さくら組',
        age_group: 'elementary',
      });

      // 2人目はクラスなし
      expect(json.data.candidates[1]).toMatchObject({
        child_id: 'child-2',
        class_name: '',
        age_group: '',
      });
    });

    it('should exclude current child when child_id is provided', async () => {
      const childrenData = [
        {
          id: 'child-1',
          family_name: 'Sato',
          given_name: 'Taro',
          family_name_kana: 'サトウ',
          given_name_kana: 'タロウ',
          birth_date: '2018-01-01',
          enrollment_status: 'enrolled',
          photo_url: null,
          parent_phone: '09011112222',
          _child_class: [],
        },
        {
          id: 'child-2',
          family_name: 'Sato',
          given_name: 'Hanako',
          family_name_kana: 'サトウ',
          given_name_kana: 'ハナコ',
          birth_date: '2019-02-01',
          enrollment_status: 'enrolled',
          photo_url: null,
          parent_phone: '09011112222',
          _child_class: [],
        },
      ];

      const supabase = createSupabaseMock({ childrenData });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });
      mockSearchByPhone.mockResolvedValue(['child-1', 'child-2']);

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1111-2222',
          child_id: 'child-1', // 本人を除外
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.candidates).toHaveLength(1);
      expect(json.data.candidates[0].child_id).toBe('child-2');
    });

    it('should return empty candidates when no phone match', async () => {
      const supabase = createSupabaseMock({ childrenData: [] });
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });
      mockSearchByPhone.mockResolvedValue([]); // 検索結果なし

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-9999-9999',
          child_id: null,
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.found).toBe(false);
      expect(json.data.candidates).toEqual([]);
      expect(json.data.total_found).toBe(0);
    });
  });

  describe('認証エラー', () => {
    it('should return 401 when metadata is null', async () => {
      const supabase = createSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1234-5678',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 404 when current_facility_id is null', async () => {
      const supabase = createSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: null, // 施設未設定
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1234-5678',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Facility not found');
    });
  });

  describe('バリデーションエラー', () => {
    it('should return 400 when phone is missing', async () => {
      const supabase = createSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          child_id: null,
          // phone が未指定
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Phone number is required');
    });

    it('should return 400 when phone is empty string', async () => {
      const supabase = createSupabaseMock({});
      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '',
          child_id: null,
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Phone number is required');
    });
  });

  describe('エラーハンドリング', () => {
    it('should return 500 when database query fails', async () => {
      const supabase = createSupabaseMock({
        childrenData: null,
        childrenError: { message: 'Database error' },
      });

      mockCreateClient.mockResolvedValue(supabase as any);
      mockGetAuthenticatedUserMetadata.mockResolvedValue({
        user_id: 'user-1',
        email: 'test@example.com',
        role: 'staff',
        current_facility_id: 'facility-1',
        current_company_id: 'company-1',
      });
      mockSearchByPhone.mockResolvedValue(['child-1']);

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1234-5678',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to search children');
    });

    it('should return 500 on unexpected error', async () => {
      mockCreateClient.mockRejectedValue(new Error('Unexpected error'));

      const request = new NextRequest('http://localhost/api/children/search-siblings', {
        method: 'POST',
        body: JSON.stringify({
          phone: '090-1234-5678',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal Server Error');
    });
  });
});
