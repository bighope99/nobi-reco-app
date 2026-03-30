import { NextRequest } from 'next/server'
import { POST } from '@/app/api/attendance/status/route'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt'

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
  hasPermission: jest.fn(),
}))

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/attendance/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const createFilterQuery = () => {
  const query: Record<string, jest.Mock> = {}
  query.select = jest.fn().mockReturnValue(query)
  query.eq = jest.fn().mockReturnValue(query)
  query.is = jest.fn().mockReturnValue(query)
  query.gte = jest.fn().mockReturnValue(query)
  query.lt = jest.fn().mockReturnValue(query)
  query.single = jest.fn()
  query.maybeSingle = jest.fn()
  return query
}

describe('POST /api/attendance/status', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>
  const mockedGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >
  const mockedHasPermission = hasPermission as jest.MockedFunction<typeof hasPermission>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('daily attendance reset failure restores soft-deleted check-in record', async () => {
    mockedGetAuthenticatedUserMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    })
    mockedHasPermission.mockReturnValue(true)

    const childQuery = createFilterQuery()
    childQuery.single.mockResolvedValue({ data: { id: 'child-1' }, error: null })

    const dailyFetchQuery = createFilterQuery()
    dailyFetchQuery.maybeSingle.mockResolvedValue({ data: { id: 'daily-1' }, error: null })

    const dailyUpdateTerminal = {
      eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'daily reset failed' } }),
    }
    const dailyUpdateQuery = {
      update: jest.fn().mockReturnValue(dailyUpdateTerminal),
    }

    const attendanceFetchQuery = createFilterQuery()
    attendanceFetchQuery.maybeSingle.mockResolvedValue({ data: { id: 'attendance-1' }, error: null })

    const softDeleteTerminal = {
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const attendanceSoftDeleteQuery = {
      update: jest.fn().mockReturnValue(softDeleteTerminal),
    }

    const restoreTerminal = {
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const attendanceRestoreQuery = {
      update: jest.fn().mockReturnValue(restoreTerminal),
    }

    let dailyFromCount = 0
    let attendanceFromCount = 0
    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') return childQuery

        if (table === 'r_daily_attendance') {
          dailyFromCount += 1
          return dailyFromCount === 1 ? dailyFetchQuery : dailyUpdateQuery
        }

        if (table === 'h_attendance') {
          attendanceFromCount += 1
          if (attendanceFromCount === 1) return attendanceFetchQuery
          if (attendanceFromCount === 2) return attendanceSoftDeleteQuery
          return attendanceRestoreQuery
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    mockedCreateClient.mockResolvedValue(mockSupabase as never)

    const response = await POST(
      buildRequest({
        child_id: 'child-1',
        date: '2026-03-30',
        status: 'cancel_check_in',
      })
    )
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('Failed to reset daily attendance')
    expect(attendanceSoftDeleteQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    )
    expect(attendanceRestoreQuery.update).toHaveBeenCalledWith({ deleted_at: null })
    expect(restoreTerminal.eq).toHaveBeenCalledWith('id', 'attendance-1')
  })
})
