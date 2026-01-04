import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { POST } from '@/app/api/attendance/checkin/route';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

const QR_SIGNATURE_SECRET = 'test-secret-key';

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/attendance/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/attendance/checkin', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetUserSession = getUserSession as jest.MockedFunction<typeof getUserSession>;

  beforeAll(() => {
    process.env.QR_SIGNATURE_SECRET = QR_SIGNATURE_SECRET;
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Signature Verification', () => {
    it('should accept valid signature', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      // Generate valid signature
      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      // Mock session
      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      // Mock Supabase auth session
      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      // Mock child query
      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            facility_id: facilityId,
            family_name: 'Test',
            given_name: 'Child',
            _child_class: [
              {
                is_current: true,
                class: {
                  id: 'class-1',
                  name: 'さくら組',
                },
              },
            ],
          },
          error: null,
        }),
      };

      // Mock attendance check
      const attendanceCheckQuery: any = {
        select: jest.fn(() => attendanceCheckQuery),
        eq: jest.fn(() => attendanceCheckQuery),
        gte: jest.fn(() => attendanceCheckQuery),
        lte: jest.fn(() => attendanceCheckQuery),
        order: jest.fn(() => attendanceCheckQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      // Mock attendance insert
      const attendanceInsertQuery: any = {
        insert: jest.fn(() => attendanceInsertQuery),
        select: jest.fn(() => attendanceInsertQuery),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'attendance-1',
            child_id: childId,
            facility_id: facilityId,
            checked_in_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          if (table === 'h_attendance') {
            const callCount = mockSupabase.from.mock.calls.filter(
              (call) => call[0] === 'h_attendance'
            ).length;
            return callCount === 1 ? attendanceCheckQuery : attendanceInsertQuery;
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data?.child_name).toBe('Test Child');
      expect(json.data?.class_name).toBe('さくら組');
    });

    it('should reject invalid signature format', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      // Mock session
      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: 'invalid-signature',
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid signature format');
    });

    it('should reject wrong signature', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      // Generate signature with wrong secret
      const wrongSignature = createHmac('sha256', 'wrong-secret')
        .update(`${childId}${facilityId}wrong-secret`)
        .digest('hex');

      // Mock session
      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            facility_id: facilityId,
            family_name: 'Test',
            given_name: 'Child',
            _child_class: [],
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: wrongSignature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid signature');
    });

    it('should handle signature as array (use first element)', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            facility_id: facilityId,
            family_name: 'Test',
            given_name: 'Child',
            _child_class: [],
          },
          error: null,
        }),
      };

      const attendanceCheckQuery: any = {
        select: jest.fn(() => attendanceCheckQuery),
        eq: jest.fn(() => attendanceCheckQuery),
        gte: jest.fn(() => attendanceCheckQuery),
        lte: jest.fn(() => attendanceCheckQuery),
        order: jest.fn(() => attendanceCheckQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const attendanceInsertQuery: any = {
        insert: jest.fn(() => attendanceInsertQuery),
        select: jest.fn(() => attendanceInsertQuery),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'attendance-1',
            child_id: childId,
            facility_id: facilityId,
            checked_in_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          if (table === 'h_attendance') {
            const callCount = mockSupabase.from.mock.calls.filter(
              (call) => call[0] === 'h_attendance'
            ).length;
            return callCount === 1 ? attendanceCheckQuery : attendanceInsertQuery;
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: [signature], // Array signature
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 401 when Supabase getSession returns no session', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';

      // Mock Supabase auth session returning null
      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: null,
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 401 when mockedGetUserSession returns a session without current_facility_id', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      // Mock session without current_facility_id
      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: null as any,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 400 when request body is missing child_id', async () => {
      const facilityId = 'facility-456';
      const userId = 'user-789';

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`missing-child-id${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      const request = buildRequest({
        token: signature,
        facility_id: facilityId,
        // child_id is missing
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Token and child_id are required');
    });

    it('should return 400 when request body is missing token', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        child_id: childId,
        facility_id: facilityId,
        // token is missing
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Token and child_id are required');
    });

    it('should return 403 when QR facility_id !== user.current_facility_id', async () => {
      const childId = 'child-123';
      const userFacilityId = 'facility-456';
      const qrFacilityId = 'facility-999'; // Different facility
      const userId = 'user-789';

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${qrFacilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: userFacilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            facility_id: userFacilityId, // Child belongs to user's facility
            family_name: 'Test',
            given_name: 'Child',
            _child_class: [],
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: qrFacilityId, // QR code has different facility
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Facility ID mismatch');
    });

    it('should return 409 when attendance check query returns an existing record for today', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            facility_id: facilityId,
            family_name: 'Test',
            given_name: 'Child',
            _child_class: [
              {
                is_current: true,
                class: {
                  id: 'class-1',
                  name: 'さくら組',
                },
              },
            ],
          },
          error: null,
        }),
      };

      // Mock attendance check returning existing record
      const attendanceCheckQuery: any = {
        select: jest.fn(() => attendanceCheckQuery),
        eq: jest.fn(() => attendanceCheckQuery),
        gte: jest.fn(() => attendanceCheckQuery),
        lte: jest.fn(() => attendanceCheckQuery),
        order: jest.fn(() => attendanceCheckQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'attendance-existing',
            checked_in_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          if (table === 'h_attendance') {
            return attendanceCheckQuery;
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Already checked in today');
      expect(json.data?.child_id).toBe(childId);
      expect(json.data?.child_name).toBe('Test Child');
      expect(json.data?.class_name).toBe('さくら組');
    });

    it('should return 500 when Supabase queries return error objects', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      // Mock child query returning error
      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'db error' },
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Child not found or access denied');
    });

    it('should return 500 when attendance insert returns error', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            facility_id: facilityId,
            family_name: 'Test',
            given_name: 'Child',
            _child_class: [],
          },
          error: null,
        }),
      };

      // Mock attendance check returning no existing record
      const attendanceCheckQuery: any = {
        select: jest.fn(() => attendanceCheckQuery),
        eq: jest.fn(() => attendanceCheckQuery),
        gte: jest.fn(() => attendanceCheckQuery),
        lte: jest.fn(() => attendanceCheckQuery),
        order: jest.fn(() => attendanceCheckQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      // Mock attendance insert returning error
      const attendanceInsertQuery: any = {
        insert: jest.fn(() => attendanceInsertQuery),
        select: jest.fn(() => attendanceInsertQuery),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'db error' },
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          if (table === 'h_attendance') {
            const callCount = mockSupabase.from.mock.calls.filter(
              (call) => call[0] === 'h_attendance'
            ).length;
            return callCount === 1 ? attendanceCheckQuery : attendanceInsertQuery;
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to record attendance');
    });

    it('should return 404 when m_children maybeSingle returns { data: null, error: null }', async () => {
      const childId = 'child-123';
      const facilityId = 'facility-456';
      const userId = 'user-789';

      const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
        .update(`${childId}${facilityId}${QR_SIGNATURE_SECRET}`)
        .digest('hex');

      mockedGetUserSession.mockResolvedValue({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-1',
        company_name: 'Test Company',
        current_facility_id: facilityId,
        facilities: [],
        classes: [],
      });

      const authQuery: any = {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: userId },
            },
          },
          error: null,
        }),
      };

      // Mock child query returning null data and null error (child not found)
      const childQuery: any = {
        select: jest.fn(() => childQuery),
        eq: jest.fn(() => childQuery),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockSupabase = {
        auth: authQuery,
        from: jest.fn((table: string) => {
          if (table === 'm_children') return childQuery;
          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        token: signature,
        child_id: childId,
        facility_id: facilityId,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Child not found or access denied');
    });
  });
});
