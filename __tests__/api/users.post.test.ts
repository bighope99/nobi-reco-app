import { NextRequest } from 'next/server';
import { POST } from '@/app/api/users/route';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/users (email invite flow)', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
  const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends an invitation email instead of generating a password', async () => {
    mockedGetMetadata.mockResolvedValue({
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    });

    const mUsersQuery: any = {
      select: jest.fn(() => mUsersQuery),
      eq: jest.fn(() => mUsersQuery),
      is: jest.fn(() => mUsersQuery),
      single: jest.fn(),
      insert: jest.fn(() => mUsersQuery),
    };

    const userFacilityQuery: any = {
      insert: jest.fn(),
    };

    const userClassQuery: any = {
      insert: jest.fn(),
    };

    mUsersQuery.single
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: 'auth-user-id',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'staff',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        error: null,
      });

    userFacilityQuery.insert.mockResolvedValue({ data: null, error: null });
    userClassQuery.insert.mockResolvedValue({ data: null, error: null });

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_users') return mUsersQuery;
        if (table === '_user_facility') return userFacilityQuery;
        if (table === '_user_class') return userClassQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const inviteUserByEmail = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'newuser@example.com',
        },
      },
      error: null,
    });
    const updateUserById = jest.fn().mockResolvedValue({ data: null, error: null });

    const createUser = jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
          email: 'newuser@example.com',
        },
      },
      error: null,
    });

    const generateLink = jest.fn().mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://example.com/invite?token=abc123',
        },
      },
      error: null,
    });

    const mockAdmin = {
      auth: {
        admin: {
          inviteUserByEmail,
          updateUserById,
          createUser,
          generateLink,
        },
      },
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);
    mockedCreateAdminClient.mockResolvedValue(mockAdmin as any);

    const request = buildRequest({
      name: 'New User',
      email: 'newuser@example.com',
      phone: '090-1234-5678',
      role: 'staff',
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
        email_confirm: false,
        app_metadata: expect.objectContaining({
          role: 'staff',
          company_id: 'company-1',
          current_facility_id: 'facility-1',
        }),
      })
    );
    expect(generateLink).toHaveBeenCalledTimes(1);
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'invite',
        email: 'newuser@example.com',
      })
    );
    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
    expect(mUsersQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auth-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        role: 'staff',
      })
    );
    expect(json.success).toBe(true);
    expect(json.data?.initial_password).toBeUndefined();
  });
});
