jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const { saveChild } = require('@/app/api/children/save/route');

describe('saveChild', () => {
  it('stores parent_name on child records for backward compatibility', async () => {
    const insertQuery: any = {
      insert: jest.fn(() => insertQuery),
      select: jest.fn(() => insertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'child-1',
          family_name: '山田',
          given_name: '花子',
          family_name_kana: 'ヤマダ',
          given_name_kana: 'ハナコ',
          birth_date: '2019-04-12',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          created_at: '2024-04-01T00:00:00.000Z',
          updated_at: '2024-04-01T00:00:00.000Z',
        },
        error: null,
      }),
    };

    const mockSupabase: any = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') return insertQuery;
        return insertQuery;
      }),
    };

    const payload = {
      basic_info: {
        family_name: '山田',
        given_name: '花子',
        birth_date: '2019-04-12',
        gender: 'female',
      },
      affiliation: {
        enrolled_at: '2024-04-01',
      },
      contact: {
        parent_name: '山田 太郎',
        parent_phone: '090-1234-5678',
        parent_email: 'taro@example.com',
      },
      permissions: {},
    };

    const response = await saveChild(payload, 'facility-1', mockSupabase);

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_name: '山田 太郎',
        parent_phone: '090-1234-5678',
        parent_email: 'taro@example.com',
      })
    );
    expect(response.status).toBe(201);
  });
});
