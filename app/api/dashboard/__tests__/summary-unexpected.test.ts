/**
 * Test file for unexpected attendance alert filtering
 *
 * Specification:
 * Given: Attendance records with different check_in_methods
 * When: Generating unexpected attendance alerts
 * Then: Only include QR code check-ins (check_in_method='qr')
 *
 * Business Rule:
 * - QR check-ins without schedule → unexpected alert (requires confirmation)
 * - Manual check-ins → always treated as scheduled (no alert)
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

const buildRequest = (params: { date?: string; class_id?: string } = {}) => {
  const url = new URL('http://localhost/api/dashboard/summary');
  if (params.date) url.searchParams.set('date', params.date);
  if (params.class_id) url.searchParams.set('class_id', params.class_id);
  return new NextRequest(url);
};

// Helper function to create a mock query builder that behaves like Supabase
function createQueryBuilder(resolvedValue: any) {
  const builder: any = {};
  builder.select = jest.fn().mockReturnValue(builder);
  builder.eq = jest.fn().mockReturnValue(builder);
  builder.in = jest.fn().mockReturnValue(builder);
  builder.is = jest.fn().mockReturnValue(builder);
  builder.gte = jest.fn().mockReturnValue(builder);
  builder.lte = jest.fn().mockReturnValue(builder);
  builder.or = jest.fn().mockReturnValue(builder);
  builder.order = jest.fn().mockReturnValue(builder);
  builder.then = jest.fn((resolve) => Promise.resolve(resolvedValue).then(resolve));
  return builder;
}

// Helper function to create mock Supabase client
function createMockSupabase(
  children: any[],
  attendanceLogs: any[],
  dailyAttendance: any[],
  schedulePatterns: any[] = []
) {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-789' } } },
        error: null,
      }),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'm_children') return createQueryBuilder({ data: children, error: null });
      if (table === 'h_attendance') return createQueryBuilder({ data: attendanceLogs, error: null });
      if (table === 'r_daily_attendance') return createQueryBuilder({ data: dailyAttendance, error: null });
      if (table === 's_attendance_schedule') return createQueryBuilder({ data: schedulePatterns, error: null });
      if (table === 'm_schools') return createQueryBuilder({ data: [], error: null });
      if (table === 's_school_schedules') return createQueryBuilder({ data: [], error: null });
      if (table === 'r_observation') return createQueryBuilder({ data: [], error: null });
      if (table === '_child_guardian') return createQueryBuilder({ data: [], error: null });
      if (table === 'm_classes') return createQueryBuilder({ data: [], error: null });
      return {};
    }),
  };
}

describe('GET /api/dashboard/summary - Unexpected Attendance Alerts', () => {
  const facilityId = 'facility-123';
  const userId = 'user-789';
  const today = new Date().toISOString().split('T')[0];

  // Increase timeout for all tests in this suite
  jest.setTimeout(30000);

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

  describe('QR check-in without schedule should be in unexpected alerts', () => {
    it('should include child checked in via QR without schedule', async () => {
      // Arrange: Child checked in via QR, no schedule
      const mockSupabase = createMockSupabase(
        [
          {
            id: 'child-1',
            family_name: 'encrypted-family',
            given_name: 'encrypted-given',
            family_name_kana: 'encrypted-kana-f',
            given_name_kana: 'encrypted-kana-g',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [
              {
                class_id: 'class-1',
                is_current: true,
                m_classes: {
                  id: 'class-1',
                  name: 'さくら組',
                  age_group: null,
                },
              },
            ],
          },
        ],
        [
          {
            child_id: 'child-1',
            checked_in_at: `${today}T01:00:00Z`, // UTC time (JST 10:00)
            checked_out_at: null,
            check_in_method: 'qr', // QR check-in
          },
        ],
        [] // No schedule
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(json.data.alerts.unexpected).toBeDefined();
      expect(json.data.alerts.unexpected).toHaveLength(1);
      expect(json.data.alerts.unexpected[0]).toMatchObject({
        child_id: 'child-1',
      });
    });
  });

  describe('Manual check-in without schedule should NOT be in unexpected alerts', () => {
    it('should exclude child checked in manually without schedule', async () => {
      // Arrange: Child checked in manually, no schedule
      const mockSupabase = createMockSupabase(
        [
          {
            id: 'child-2',
            family_name: 'encrypted-family',
            given_name: 'encrypted-given',
            family_name_kana: 'encrypted-kana-f',
            given_name_kana: 'encrypted-kana-g',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [
              {
                class_id: 'class-1',
                is_current: true,
                m_classes: {
                  id: 'class-1',
                  name: 'さくら組',
                  age_group: null,
                },
              },
            ],
          },
        ],
        [
          {
            child_id: 'child-2',
            checked_in_at: `${today}T01:00:00Z`,
            checked_out_at: null,
            check_in_method: 'manual', // Manual check-in
          },
        ],
        [] // No schedule
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(json.data.alerts.unexpected).toBeDefined();
      expect(json.data.alerts.unexpected).toHaveLength(0); // Should be empty (manual check-in excluded)
    });
  });

  describe('Mixed scenarios', () => {
    it('should only include QR check-ins in unexpected alerts (mixed data)', async () => {
      // Arrange: Multiple children with different check-in methods
      const mockSupabase = createMockSupabase(
        [
          {
            id: 'child-qr-unscheduled',
            family_name: 'encrypted-f1',
            given_name: 'encrypted-g1',
            family_name_kana: 'encrypted-kf1',
            given_name_kana: 'encrypted-kg1',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
          },
          {
            id: 'child-manual-unscheduled',
            family_name: 'encrypted-f2',
            given_name: 'encrypted-g2',
            family_name_kana: 'encrypted-kf2',
            given_name_kana: 'encrypted-kg2',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
          },
          {
            id: 'child-qr-scheduled',
            family_name: 'encrypted-f3',
            given_name: 'encrypted-g3',
            family_name_kana: 'encrypted-kf3',
            given_name_kana: 'encrypted-kg3',
            birth_date: '2018-04-01',
            grade_add: 0,
            photo_url: null,
            school_id: null,
            _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
          },
        ],
        [
          { child_id: 'child-qr-unscheduled', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'qr' },
          { child_id: 'child-manual-unscheduled', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'manual' },
          { child_id: 'child-qr-scheduled', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'qr' },
        ],
        [
          { child_id: 'child-qr-scheduled', status: 'scheduled' }, // Only this child has schedule
        ]
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(json.data.alerts.unexpected).toBeDefined();
      expect(json.data.alerts.unexpected).toHaveLength(1); // Only QR unscheduled
      expect(json.data.alerts.unexpected[0].child_id).toBe('child-qr-unscheduled');
    });
  });

  describe('Scheduled attendance should never be in unexpected alerts', () => {
    it('should exclude QR check-in WITH schedule from unexpected alerts', async () => {
      // Arrange: Child checked in via QR but has schedule
      const mockSupabase = createMockSupabase(
        [{
          id: 'child-3',
          family_name: 'encrypted-f',
          given_name: 'encrypted-g',
          family_name_kana: 'encrypted-kf',
          given_name_kana: 'encrypted-kg',
          birth_date: '2018-04-01',
          grade_add: 0,
          photo_url: null,
          school_id: null,
          _child_class: [{ class_id: 'class-1', is_current: true, m_classes: { id: 'class-1', name: 'さくら組', age_group: null } }],
        }],
        [{ child_id: 'child-3', checked_in_at: `${today}T01:00:00Z`, checked_out_at: null, check_in_method: 'qr' }],
        [{ child_id: 'child-3', status: 'scheduled' }] // Has schedule
      );

      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = buildRequest({ date: today });

      // Act
      const response = await GET(request);
      const json = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(json.data.alerts.unexpected).toBeDefined();
      expect(json.data.alerts.unexpected).toHaveLength(0); // Scheduled attendance excluded
    });
  });
});
