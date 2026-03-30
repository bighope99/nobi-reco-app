import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SelfCheckInPage from '@/app/attendance/self/page'

describe('SelfCheckInPage undo existing attendance', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString()

      if (url === '/api/attendance/self-checkin/children') {
        return {
          ok: true,
          json: async () => ({
            groups: {
              あ: [
                {
                  id: 'child-1',
                  kanaName: 'あい',
                  kanjiName: '相沢 あい',
                  status: 'checked_in',
                  attendanceId: 'att-checked-in',
                  checkedInAt: '2026-03-30T09:00:00+09:00',
                },
                {
                  id: 'child-2',
                  kanaName: 'あお',
                  kanjiName: '青木 あお',
                  status: 'checked_out',
                  attendanceId: 'att-checked-out',
                  checkedInAt: '2026-03-30T09:00:00+09:00',
                  checkedOutAt: '2026-03-30T17:00:00+09:00',
                },
              ],
            },
          }),
        } as Response
      }

      if (url === '/api/attendance/self-checkin' && init?.method === 'DELETE') {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response
      }

      if (url === '/api/attendance/self-checkin' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ attendance_id: 'unexpected-post' }),
        } as Response
      }

      return {
        ok: false,
        json: async () => ({ error: 'unexpected request' }),
      } as Response
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('今日すでに出席済みの児童を開いた場合はPOSTせずに出席取り消しできる', async () => {
    render(<SelfCheckInPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /あ/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /あ/ }))
    fireEvent.click(screen.getByRole('button', { name: /きたよ！ 09:00　タップでかえる/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'とりけす' })).toBeInTheDocument()
      expect(screen.getByText('09:00')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'とりけす' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/attendance/self-checkin', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ attendance_id: 'att-checked-in', action: 'check_in' }),
      }))
    })

    expect((global.fetch as jest.Mock).mock.calls.some((call) =>
      call[0] === '/api/attendance/self-checkin' && call[1]?.method === 'POST'
    )).toBe(false)
  })

  it('今日すでに帰宅済みの児童を開いた場合はPOSTせずに帰宅取り消しできる', async () => {
    render(<SelfCheckInPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /あ/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /あ/ }))
    fireEvent.click(screen.getByRole('button', { name: /かえったよ 17:00/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'とりけす' })).toBeInTheDocument()
      expect(screen.getByText('さようなら！')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'とりけす' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/attendance/self-checkin', expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ attendance_id: 'att-checked-out', action: 'check_out' }),
      }))
    })

    expect((global.fetch as jest.Mock).mock.calls.some((call) =>
      call[0] === '/api/attendance/self-checkin' && call[1]?.method === 'POST'
    )).toBe(false)
  })
})
