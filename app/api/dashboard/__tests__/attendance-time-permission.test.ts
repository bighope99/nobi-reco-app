/**
 * Test file for attendance time edit permission
 *
 * Specification:
 * Given: A user sends action_timestamp to change check-in/check-out time
 * When: User role is 'staff' (not admin)
 * Then: action_timestamp is IGNORED and current time is used
 *
 * When: User role is 'facility_admin' or higher
 * Then: action_timestamp is used (within ±5 min limit)
 */

import { NextRequest } from 'next/server';
import { POST } from '../attendance/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
  hasPermission: jest.requireActual('@/lib/auth/jwt').hasPermission,
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedGetMeta = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

const facilityId = 'facility-123';
const childId = 'child-456';
const userId = 'user-789';

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/dashboard/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const buildMockSupabase = (attendanceInsert: jest.Mock, dailyInsert: jest.Mock) => ({
  from: jest.fn().mockImplementation((table: string) => {
    if (table === 'm_children') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: childId }, error: null }),
      };
    }
    if (table === 'r_daily_attendance') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: dailyInsert,
      };
    }
    if (table === 'h_attendance') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: attendanceInsert,
      };
    }
    return {};
  }),
});

describe('POST /api/dashboard/attendance - action_timestamp permission', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('staff role', () => {
    beforeEach(() => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'staff',
        company_id: 'company-1',
        current_facility_id: facilityId,
      });
    });

    it('should IGNORE action_timestamp and use current time for staff', async () => {
      const attendanceInsert = jest.fn().mockResolvedValue({ error: null });
      const dailyInsert = jest.fn().mockResolvedValue({ error: null });
      mockedCreateClient.mockResolvedValue(buildMockSupabase(attendanceInsert, dailyInsert) as any);

      // staffが3分前の時刻を送信
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const beforeCall = Date.now();

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
        action_timestamp: threeMinutesAgo,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // staffが送ったaction_timestampは無視され、現在時刻に近い値が使われる
      const insertCall = attendanceInsert.mock.calls[0][0];
      const usedTime = new Date(insertCall.checked_in_at).getTime();
      const afterCall = Date.now();

      // 使用された時刻が、APIコール前後の間にある（action_timestampの3分前ではない）
      expect(usedTime).toBeGreaterThanOrEqual(beforeCall - 1000); // 1秒の余裕
      expect(usedTime).toBeLessThanOrEqual(afterCall + 1000);
    });
  });

  describe('facility_admin role', () => {
    beforeEach(() => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'facility_admin',
        company_id: 'company-1',
        current_facility_id: facilityId,
      });
    });

    it('should USE action_timestamp within ±5 min for facility_admin', async () => {
      const attendanceInsert = jest.fn().mockResolvedValue({ error: null });
      const dailyInsert = jest.fn().mockResolvedValue({ error: null });
      mockedCreateClient.mockResolvedValue(buildMockSupabase(attendanceInsert, dailyInsert) as any);

      // facility_adminが3分前の時刻を送信
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
        action_timestamp: threeMinutesAgo,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // facility_adminが送ったaction_timestampが使用される
      const insertCall = attendanceInsert.mock.calls[0][0];
      const usedTime = new Date(insertCall.checked_in_at).getTime();
      const expectedTime = new Date(threeMinutesAgo).getTime();

      // 使用された時刻がaction_timestampに近い（1秒以内）
      expect(Math.abs(usedTime - expectedTime)).toBeLessThan(1000);
    });

    it('should IGNORE action_timestamp beyond ±5 min even for facility_admin', async () => {
      const attendanceInsert = jest.fn().mockResolvedValue({ error: null });
      const dailyInsert = jest.fn().mockResolvedValue({ error: null });
      mockedCreateClient.mockResolvedValue(buildMockSupabase(attendanceInsert, dailyInsert) as any);

      // facility_adminが10分前の時刻を送信（±5分を超える）
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const beforeCall = Date.now();

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
        action_timestamp: tenMinutesAgo,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // ±5分を超えるので無視され、現在時刻が使われる
      const insertCall = attendanceInsert.mock.calls[0][0];
      const usedTime = new Date(insertCall.checked_in_at).getTime();
      const afterCall = Date.now();

      expect(usedTime).toBeGreaterThanOrEqual(beforeCall - 1000);
      expect(usedTime).toBeLessThanOrEqual(afterCall + 1000);
    });
  });

  describe('company_admin role', () => {
    beforeEach(() => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'company_admin',
        company_id: 'company-1',
        current_facility_id: facilityId,
      });
    });

    it('should USE action_timestamp within ±5 min for company_admin', async () => {
      const attendanceInsert = jest.fn().mockResolvedValue({ error: null });
      const dailyInsert = jest.fn().mockResolvedValue({ error: null });
      mockedCreateClient.mockResolvedValue(buildMockSupabase(attendanceInsert, dailyInsert) as any);

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
        action_timestamp: twoMinutesAgo,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      const insertCall = attendanceInsert.mock.calls[0][0];
      const usedTime = new Date(insertCall.checked_in_at).getTime();
      const expectedTime = new Date(twoMinutesAgo).getTime();

      expect(Math.abs(usedTime - expectedTime)).toBeLessThan(1000);
    });
  });

  describe('site_admin role', () => {
    beforeEach(() => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'site_admin',
        company_id: 'company-1',
        current_facility_id: facilityId,
      });
    });

    it('should USE action_timestamp within ±5 min for site_admin', async () => {
      const attendanceInsert = jest.fn().mockResolvedValue({ error: null });
      const dailyInsert = jest.fn().mockResolvedValue({ error: null });
      mockedCreateClient.mockResolvedValue(buildMockSupabase(attendanceInsert, dailyInsert) as any);

      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();

      const request = buildRequest({
        action: 'check_in',
        child_id: childId,
        action_timestamp: oneMinuteAgo,
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      const insertCall = attendanceInsert.mock.calls[0][0];
      const usedTime = new Date(insertCall.checked_in_at).getTime();
      const expectedTime = new Date(oneMinuteAgo).getTime();

      expect(Math.abs(usedTime - expectedTime)).toBeLessThan(1000);
    });
  });
});
