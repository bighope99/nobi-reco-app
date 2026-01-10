import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/classes/[id]/route';
import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/classes/class-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /api/classes/:id', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('updates facility_id when provided', async () => {
    const authGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const userQuery: any = {
      select: jest.fn(() => userQuery),
      eq: jest.fn(() => userQuery),
      single: jest.fn().mockResolvedValue({
        data: { role: 'company_admin', company_id: 'company-1' },
        error: null,
      }),
    };

    const classSelectQuery: any = {
      select: jest.fn(() => classSelectQuery),
      eq: jest.fn(() => classSelectQuery),
      is: jest.fn(() => classSelectQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'class-1', facility_id: 'facility-1' },
        error: null,
      }),
    };

    const classUpdateQuery: any = {
      update: jest.fn(() => classUpdateQuery),
      eq: jest.fn(() => classUpdateQuery),
      select: jest.fn(() => classUpdateQuery),
      single: jest.fn().mockResolvedValue({
        data: { id: 'class-1', name: 'すみれ組', updated_at: '2024-01-01T00:00:00.000Z' },
        error: null,
      }),
    };

    let classCallCount = 0;
    const mockSupabase = {
      auth: { getUser: authGetUser },
      from: jest.fn((table: string) => {
        if (table === 'm_users') return userQuery;
        if (table === 'm_classes') {
          classCallCount += 1;
          return classCallCount === 1 ? classSelectQuery : classUpdateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = buildRequest({
      name: 'すみれ組',
      facility_id: 'facility-2',
      capacity: 25,
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'class-1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(classUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        facility_id: 'facility-2',
        name: 'すみれ組',
        capacity: 25,
      })
    );
    expect(json.success).toBe(true);
  });
});
