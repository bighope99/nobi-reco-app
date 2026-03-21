/**
 * useSession フックのテスト
 *
 * テスト対象: hooks/useSession.ts
 *
 * useSession は sessionStorage からセッションを読み込み、
 * 存在しない場合は Supabase Auth + /api/auth/session API で復旧する Client Hook。
 */
import { renderHook, waitFor } from '@testing-library/react'
import { useSession } from '@/hooks/useSession'
import { UserSession } from '@/lib/auth/session'

// @/utils/supabase/client をモック化
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(),
}))

import { createClient } from '@/utils/supabase/client'

// テスト用のセッションデータ
const mockSession: UserSession = {
  user_id: 'user-abc-123',
  email: 'test@example.com',
  name: 'テストユーザー',
  role: 'staff',
  company_id: 'company-xyz',
  company_name: 'テスト会社',
  facilities: [
    {
      facility_id: 'facility-001',
      facility_name: 'テスト施設',
      is_primary: true,
    },
  ],
  current_facility_id: 'facility-001',
  classes: [
    {
      class_id: 'class-001',
      class_name: 'ひまわり組',
      facility_id: 'facility-001',
      class_role: 'main',
      is_homeroom: true,
    },
  ],
}

// sessionStorage のモック
const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
})

// Supabase クライアントのモック
function buildMockSupabase(user: { id: string } | null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  }
}

describe('useSession', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    mockSessionStorage.clear()
    mockSessionStorage.getItem.mockClear()
    mockSessionStorage.setItem.mockClear()
    mockSessionStorage.removeItem.mockClear()
    ;(createClient as jest.Mock).mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  // ------------------------------------------------------------------
  // Given: sessionStorage に有効な UserSession JSON が保存されている
  // When:  useSession フックを呼び出す
  // Then:  即座にその UserSession が返されること
  // ------------------------------------------------------------------
  it('sessionStorage に有効なセッションがある場合、即座にそのセッションを返すこと', async () => {
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(mockSession))

    // このテストでは API が呼ばれないことを確認するためにフェッチをモック化
    const fetchMock = jest.fn()
    global.fetch = fetchMock

    const { result } = renderHook(() => useSession())

    await waitFor(() => {
      expect(result.current).toEqual(mockSession)
    })

    // API は呼ばれていないこと（sessionStorage から即時返却されるため）
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Given: sessionStorage が空で Supabase Auth に有効なユーザーが存在する
  // When:  useSession フックを呼び出す
  // Then:  /api/auth/session API からセッションを復旧してセットすること
  // ------------------------------------------------------------------
  it('sessionStorage が空で Supabase Auth にユーザーがいる場合、APIからセッションを復旧すること', async () => {
    mockSessionStorage.getItem.mockReturnValue(null as unknown as string)
    ;(createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ id: 'user-abc-123' })
    )

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as Response)

    const { result } = renderHook(() => useSession())

    await waitFor(() => {
      expect(result.current).toEqual(mockSession)
    })

    // /api/auth/session への POST が呼ばれていること
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Skip-SessionGuard': '1' },
        body: JSON.stringify({ user_id: 'user-abc-123' }),
      })
    )

    // sessionStorage に保存されていること
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'user_session',
      JSON.stringify(mockSession)
    )
  })

  // ------------------------------------------------------------------
  // Given: sessionStorage が空で Supabase Auth にユーザーが存在しない
  // When:  useSession フックを呼び出す
  // Then:  null が返され続けること
  // ------------------------------------------------------------------
  it('sessionStorage が空で Supabase Auth にユーザーがいない場合、null を返すこと', async () => {
    mockSessionStorage.getItem.mockReturnValue(null as unknown as string)
    ;(createClient as jest.Mock).mockReturnValue(
      buildMockSupabase(null)
    )

    global.fetch = jest.fn()

    const { result } = renderHook(() => useSession())

    // 非同期処理の完了を待つ
    await waitFor(() => {
      expect((createClient as jest.Mock).mock.calls.length).toBeGreaterThan(0)
    })

    expect(result.current).toBeNull()
    // API は呼ばれていないこと
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Given: sessionStorage に壊れた JSON が保存されている
  // When:  useSession フックを呼び出す
  // Then:  sessionStorage から削除し、API での復旧を試みること
  // ------------------------------------------------------------------
  it('sessionStorage の JSON が壊れている場合、削除してAPIで復旧を試みること', async () => {
    mockSessionStorage.getItem.mockReturnValue('{ INVALID JSON %%%')
    ;(createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ id: 'user-abc-123' })
    )

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    } as Response)

    const { result } = renderHook(() => useSession())

    await waitFor(() => {
      expect(result.current).toEqual(mockSession)
    })

    // 壊れたデータが削除されていること
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user_session')

    // その後 API で復旧されていること
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ method: 'POST' })
    )
  })

  // ------------------------------------------------------------------
  // Given: sessionStorage が空で Supabase Auth にユーザーが存在する
  // When:  /api/auth/session API がエラーレスポンス（ok: false）を返す
  // Then:  session は null のまま維持されること
  // ------------------------------------------------------------------
  it('/api/auth/session API が失敗する場合、null のまま維持すること', async () => {
    mockSessionStorage.getItem.mockReturnValue(null as unknown as string)
    ;(createClient as jest.Mock).mockReturnValue(
      buildMockSupabase({ id: 'user-abc-123' })
    )

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    } as Response)

    const { result } = renderHook(() => useSession())

    // API 呼び出し完了を待つ
    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(0)
    })

    // セッションは null のまま
    expect(result.current).toBeNull()
    // sessionStorage には保存されていないこと
    expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
  })
})
