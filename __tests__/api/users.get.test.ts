import { NextRequest } from 'next/server';
import { GET } from '@/app/api/users/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

describe('GET /api/users', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('maps class_role into assigned_classes.is_main', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const usersQuery: any = {
      select: jest.fn(() => usersQuery),
      is: jest.fn(() => usersQuery),
      eq: jest.fn(() => usersQuery),
      or: jest.fn(() => usersQuery),
      order: jest.fn(),
    };

    const classQuery: any = {
      select: jest.fn(() => classQuery),
      eq: jest.fn(),
    };

    const usersData = [
      {
        id: 'user-1',
        email: 'taro@example.com',
        name: '山田 太郎',
        name_kana: 'ヤマダ タロウ',
        role: 'staff',
        phone: '090-0000-0000',
        hire_date: '2024-01-01',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
      },
    ];

    usersQuery.order.mockImplementationOnce(() => ({
      order: jest.fn().mockResolvedValue({ data: usersData, error: null }),
    }));

    classQuery.eq
      .mockImplementationOnce(() => classQuery)
      .mockResolvedValue({
        data: [
          {
            class_role: 'main',
            m_classes: { id: 'class-1', name: 'ひまわり組' },
          },
          {
            class_role: 'sub',
            m_classes: { id: 'class-2', name: 'さくら組' },
          },
        ],
        error: null,
      });

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return usersQuery;
        if (table === '_user_class') return classQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost/api/users');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.users[0].assigned_classes).toEqual([
      { class_id: 'class-1', class_name: 'ひまわり組', is_main: true },
      { class_id: 'class-2', class_name: 'さくら組', is_main: false },
    ]);
  });
});
