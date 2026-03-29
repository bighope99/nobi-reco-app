/**
 * Test file for attendance time PATCH API
 *
 * Specification:
 * Given: PATCH /api/attendance/time
 * When: staff role
 * Then: 403 Forbidden
 *
 * When: facility_admin role with valid data
 * Then: 200 success
 */

import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt'

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
  hasPermission: jest.requireActual('@/lib/auth/jwt').hasPermission,
}))

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockedGetMeta = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>

const facilityId = 'facility-123'
const childId = 'child-456'
const userId = 'user-789'
const attendanceId = 'attendance-001'
const today = '2026-01-26'

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/attendance/time', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const buildMockSupabase = (opts: { childFound?: boolean; attendanceFound?: boolean; updateError?: boolean } = {}) => {
  const { childFound = true, attendanceFound = true, updateError = false } = opts
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: childFound ? { id: childId } : null,
            error: childFound ? null : { message: 'not found' },
          }),
        }
      }
      if (table === 'h_attendance') {
        const mockUpdate = jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: updateError ? { message: 'update failed' } : null }),
        })
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: attendanceFound
              ? {
                  id: attendanceId,
                  checked_in_at: `${today}T09:00:00+09:00`,
                  checked_out_at: null,
                }
              : null,
            error: null,
          }),
          update: mockUpdate,
        }
      }
      return {}
    }),
  }
}

describe('PATCH /api/attendance/time', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('permission check', () => {
    it('should return 403 for staff role', async () => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'staff',
        company_id: 'company-1',
        current_facility_id: facilityId,
      })
      mockedCreateClient.mockResolvedValue(buildMockSupabase() as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'checked_in_at',
        time: '09:30',
      }))
      const json = await response.json()

      expect(response.status).toBe(403)
      expect(json.success).toBe(false)
    })

    it('should return 200 for facility_admin role', async () => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'facility_admin',
        company_id: 'company-1',
        current_facility_id: facilityId,
      })
      mockedCreateClient.mockResolvedValue(buildMockSupabase() as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'checked_in_at',
        time: '09:30',
      }))
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
    })

    it('should return 200 for company_admin role', async () => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'company_admin',
        company_id: 'company-1',
        current_facility_id: facilityId,
      })
      mockedCreateClient.mockResolvedValue(buildMockSupabase() as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'checked_in_at',
        time: '09:30',
      }))
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
    })

    it('should return 401 if not authenticated', async () => {
      mockedGetMeta.mockResolvedValue(null)
      mockedCreateClient.mockResolvedValue(buildMockSupabase() as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'checked_in_at',
        time: '09:30',
      }))

      expect(response.status).toBe(401)
    })
  })

  describe('validation', () => {
    beforeEach(() => {
      mockedGetMeta.mockResolvedValue({
        user_id: userId,
        role: 'facility_admin',
        company_id: 'company-1',
        current_facility_id: facilityId,
      })
    })

    it('should return 400 for invalid field', async () => {
      mockedCreateClient.mockResolvedValue(buildMockSupabase() as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'invalid_field',
        time: '09:30',
      }))
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
    })

    it('should return 400 for invalid time format', async () => {
      mockedCreateClient.mockResolvedValue(buildMockSupabase() as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'checked_in_at',
        time: '9:30', // HH:MM ではない
      }))
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
    })

    it('should return 404 if no attendance record found', async () => {
      mockedCreateClient.mockResolvedValue(buildMockSupabase({ attendanceFound: false }) as any)

      const response = await PATCH(buildRequest({
        child_id: childId,
        date: today,
        field: 'checked_in_at',
        time: '09:30',
      }))
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
    })
  })
})
