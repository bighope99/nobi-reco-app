/**
 * Test file for unscheduled attendance filtering in dashboard display
 *
 * Specification:
 * Given: showUnscheduled=true query parameter
 * When: Fetching attendance list
 * Then: Display ONLY children with (is_scheduled_today=false AND status='absent')
 *
 * Business Rules:
 * - Children who are checked_in should NOT appear in unscheduled section
 * - Children who are checked_out should NOT appear in unscheduled section
 * - Only absent + unscheduled children should be displayed
 *
 * Use Case: Staff wants to see who is NOT scheduled today (to avoid confusion with no-shows)
 */

import { NextRequest } from 'next/server';
import { GET } from '../summary/route';
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

const buildRequest = (params: { date?: string; showUnscheduled?: string } = {}) => {
  const url = new URL('http://localhost/api/dashboard/summary');
  if (params.date) url.searchParams.set('date', params.date);
  if (params.showUnscheduled) url.searchParams.set('showUnscheduled', params.showUnscheduled);
  return new NextRequest(url);
};

describe('GET /api/dashboard/summary - Unscheduled Filter', () => {
  const facilityId = 'facility-123';
  const userId = 'user-789';
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    jest.resetAllMocks();

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

  describe('showUnscheduled=true filter behavior', () => {
    it('should include child with no schedule and status=absent', async () => {
      // Arrange: Unscheduled absent child
      const mockSupabase = createMockSupabase([
        {
          id: 'child-1',
          family_name: 'enc-f1',
          given_name: 'enc-g1',
          family_name_kana: 'enc-kf1',
          given_name_kana: 'enc-kg1',
          birth_date: '2018-04-01',
          grade_add: 0,
          photo_url: null,
          school_id: null,
          _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
        },
      ], [], []); // No attendance, no schedule

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today, showUnscheduled: 'true' });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      const unscheduledAbsent = json.attendance_list.filter(
        (c: any) => !c.is_scheduled_today && c.status === 'absent'
      );
      expect(unscheduledAbsent).toHaveLength(1);
      expect(unscheduledAbsent[0].child_id).toBe('child-1');
    });

    it('should exclude unscheduled child with status=checked_in', async () => {
      // Arrange: Unscheduled but checked in (manual check-in)
      const mockSupabase = createMockSupabase(
        [
          {
            id: 'child-2',
            family_name: 'enc-f2',
            given_name: 'enc-g2',
            family_name_kana: 'enc-kf2',
            given_name_kana: 'enc-kg2',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
          },
        ],
        [{ child_id: 'child-2', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'manual' }],
        [] // No schedule
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today, showUnscheduled: 'true' });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      const unscheduledAbsent = json.attendance_list.filter(
        (c: any) => !c.is_scheduled_today && c.status === 'absent'
      );
      expect(unscheduledAbsent).toHaveLength(0); // Should be excluded (checked_in)
    });

    it('should exclude unscheduled child with status=checked_out', async () => {
      // Arrange: Unscheduled but checked out
      const mockSupabase = createMockSupabase(
        [
          {
            id: 'child-3',
            family_name: 'enc-f3',
            given_name: 'enc-g3',
            family_name_kana: 'enc-kf3',
            given_name_kana: 'enc-kg3',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
          },
        ],
        [
          {
            child_id: 'child-3',
            checked_in_at: `${today}T01:00:00Z`,
            checked_out_at: `${today}T08:00:00Z`,
            check_in_method: 'manual',
          },
        ],
        [] // No schedule
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today, showUnscheduled: 'true' });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      const unscheduledAbsent = json.attendance_list.filter(
        (c: any) => !c.is_scheduled_today && c.status === 'absent'
      );
      expect(unscheduledAbsent).toHaveLength(0); // Should be excluded (checked_out)
    });

    it('should exclude scheduled child regardless of status', async () => {
      // Arrange: Scheduled but absent
      const mockSupabase = createMockSupabase(
        [
          {
            id: 'child-4',
            family_name: 'enc-f4',
            given_name: 'enc-g4',
            family_name_kana: 'enc-kf4',
            given_name_kana: 'enc-kg4',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
          },
        ],
        [], // No attendance
        [{ child_id: 'child-4', status: 'scheduled' }] // Has schedule
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today, showUnscheduled: 'true' });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      const unscheduledAbsent = json.attendance_list.filter(
        (c: any) => !c.is_scheduled_today && c.status === 'absent'
      );
      expect(unscheduledAbsent).toHaveLength(0); // Should be excluded (is_scheduled_today=true)
    });
  });

  describe('Mixed scenario: multiple children with different statuses', () => {
    it('should only show unscheduled + absent children', async () => {
      // Arrange: Mix of scheduled/unscheduled and different statuses
      const mockSupabase = createMockSupabase(
        [
          { id: 'child-unscheduled-absent', family_name: 'f1', given_name: 'g1', family_name_kana: 'kf1', given_name_kana: 'kg1', birth_date: '2018-04-01', grade_add: 0, photo_url: null, school_id: null, _child_class: [{ class_id: 'c1', is_current: true, m_classes: { id: 'c1', name: 'さくら組', age_group: null } }] },
          { id: 'child-unscheduled-checkedin', family_name: 'f2', given_name: 'g2', family_name_kana: 'kf2', given_name_kana: 'kg2', birth_date: '2018-04-01', grade_add: 0, photo_url: null, school_id: null, _child_class: [{ class_id: 'c1', is_current: true, m_classes: { id: 'c1', name: 'さくら組', age_group: null } }] },
          { id: 'child-scheduled-absent', family_name: 'f3', given_name: 'g3', family_name_kana: 'kf3', given_name_kana: 'kg3', birth_date: '2018-04-01', grade_add: 0, photo_url: null, school_id: null, _child_class: [{ class_id: 'c1', is_current: true, m_classes: { id: 'c1', name: 'さくら組', age_group: null } }] },
          { id: 'child-scheduled-checkedin', family_name: 'f4', given_name: 'g4', family_name_kana: 'kf4', given_name_kana: 'kg4', birth_date: '2018-04-01', grade_add: 0, photo_url: null, school_id: null, _child_class: [{ class_id: 'c1', is_current: true, m_classes: { id: 'c1', name: 'さくら組', age_group: null } }] },
        ],
        [
          { child_id: 'child-unscheduled-checkedin', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'manual' },
          { child_id: 'child-scheduled-checkedin', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'qr' },
        ],
        [
          { child_id: 'child-scheduled-absent', status: 'scheduled' },
          { child_id: 'child-scheduled-checkedin', status: 'scheduled' },
        ]
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today, showUnscheduled: 'true' });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      const unscheduledAbsent = json.attendance_list.filter(
        (c: any) => !c.is_scheduled_today && c.status === 'absent'
      );
      expect(unscheduledAbsent).toHaveLength(1);
      expect(unscheduledAbsent[0].child_id).toBe('child-unscheduled-absent');
    });
  });
});

// Helper function to create mock Supabase client
function createMockSupabase(
  children: any[],
  attendanceLogs: any[],
  dailyAttendance: any[]
) {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-789' } } },
        error: null,
      }),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: children, error: null }),
        };
      }
      if (table === 'h_attendance') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: attendanceLogs, error: null }),
        };
      }
      if (table === 'r_daily_attendance') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: dailyAttendance, error: null }),
        };
      }
      if (table === 'm_schools') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'r_school_schedules') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'h_observations') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'r_guardian_child_link') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === 'r_attendance_schedule_patterns') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {};
    }),
  };
}
