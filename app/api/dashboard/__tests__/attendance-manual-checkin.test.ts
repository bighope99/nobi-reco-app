/**
 * Test file for manual check-in status logic
 *
 * Specification:
 * Given: Manual check-in action (check_in_method='manual')
 * When: Attendance is recorded
 * Then: Status is ALWAYS 'scheduled' regardless of dailyRecord existence
 *
 * Background:
 * - QR code check-ins follow different rules (scheduled if dailyRecord exists, irregular otherwise)
 * - Manual check-ins are always treated as scheduled attendance
 * - This ensures staff-initiated check-ins are not flagged as unexpected
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../attendance/route';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedGetUserSession = getUserSession as jest.MockedFunction<typeof getUserSession>;

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/dashboard/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/dashboard/attendance - Manual Check-In Status', () => {
  const facilityId = 'facility-123';
  const childId = 'child-456';
  const userId = 'user-789';
  const attendanceDate = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    jest.resetAllMocks();

    // Mock user session
    mockedGetUserSession.mockResolvedValue({
      user_id: userId,
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'staff',
      company_id: 'company-1',
      company_name: 'Test Company',
      current_facility_id: facilityId,
      facilities: [],
      classes: [],
    });
  });

  describe('Manual check-in ALWAYS sets status to "scheduled"', () => {
    it('should set status to "scheduled" when dailyRecord EXISTS', async () => {
      // Arrange: Child has a scheduled attendance (dailyRecord exists)
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      const dailyAttendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'daily-1',
            child_id: childId,
            facility_id: facilityId,
            attendance_date: attendanceDate,
            status: 'scheduled',
          },
          error: null,
        }),
        update: mockUpdate,
        insert: mockInsert,
      };

      const attendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null, // No existing attendance
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: userId } } },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'r_daily_attendance') return dailyAttendanceMock;
          if (table === 'h_attendance') return attendanceMock;
          return {};
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
      });

      // Act
      const response = await POST(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify that r_daily_attendance was updated with status='scheduled'
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'scheduled',
          updated_by: userId,
        })
      );
    });

    it('should set status to "scheduled" when dailyRecord DOES NOT EXIST', async () => {
      // Arrange: Child has NO scheduled attendance (dailyRecord does not exist)
      const mockDailyInsert = jest.fn().mockResolvedValue({ error: null });
      const mockAttendanceInsert = jest.fn().mockResolvedValue({ error: null });

      const dailyAttendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null, // No dailyRecord
          error: null,
        }),
        insert: mockDailyInsert,
      };

      const attendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        insert: mockAttendanceInsert,
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: userId } } },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'r_daily_attendance') return dailyAttendanceMock;
          if (table === 'h_attendance') return attendanceMock;
          return {};
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
      });

      // Act
      const response = await POST(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // Verify that r_daily_attendance was INSERTED with status='scheduled'
      // This is the key test: even without dailyRecord, manual check-in creates 'scheduled'
      expect(mockDailyInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'scheduled', // MUST be 'scheduled', NOT 'irregular'
          child_id: childId,
          facility_id: facilityId,
          attendance_date: attendanceDate,
        })
      );
    });

    it('should never set status to "irregular" for manual check-in', async () => {
      // Arrange: Explicitly test that 'irregular' is never used
      const mockDailyInsert = jest.fn().mockResolvedValue({ error: null });
      const mockAttendanceInsert = jest.fn().mockResolvedValue({ error: null });

      const dailyAttendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null, // No dailyRecord - this would trigger 'irregular' in QR flow
          error: null,
        }),
        insert: mockDailyInsert,
      };

      const attendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        insert: mockAttendanceInsert,
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: userId } } },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'r_daily_attendance') return dailyAttendanceMock;
          if (table === 'h_attendance') return attendanceMock;
          return {};
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
      });

      // Act
      const response = await POST(request);
      await response.json();

      // Assert: Verify 'irregular' is NEVER passed
      expect(mockDailyInsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'irregular',
        })
      );
    });
  });

  describe('h_attendance record creation', () => {
    it('should create h_attendance with check_in_method="manual"', async () => {
      // Arrange
      const mockDailyInsert = jest.fn().mockResolvedValue({ error: null });
      const mockAttendanceInsert = jest.fn().mockResolvedValue({ error: null });

      const dailyAttendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        insert: mockDailyInsert,
      };

      const attendanceMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        insert: mockAttendanceInsert,
      };

      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: userId } } },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'r_daily_attendance') return dailyAttendanceMock;
          if (table === 'h_attendance') return attendanceMock;
          return {};
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
      });

      // Act
      await POST(request);

      // Assert: Verify check_in_method is set correctly
      expect(mockAttendanceInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          check_in_method: 'manual',
          checked_in_by: userId,
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should return 409 if already checked in', async () => {
      // Arrange: Existing attendance record
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: userId } } },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'r_daily_attendance') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            };
          }
          if (table === 'h_attendance') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              is: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  id: 'attendance-1',
                  checked_in_at: new Date().toISOString(),
                }, // Already checked in
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
      });

      // Act
      const response = await POST(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(409);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Already checked in today');
    });

    it('should return 400 if child_id is missing', async () => {
      // Arrange
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: userId } } },
            error: null,
          }),
        },
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        // child_id is missing
      });

      // Act
      const response = await POST(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe('child_id and action are required');
    });

    it('should return 401 if not authenticated', async () => {
      // Arrange
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        },
        from: jest.fn(),
      };

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
      });

      // Act
      const response = await POST(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Unauthorized');
    });
  });
});
