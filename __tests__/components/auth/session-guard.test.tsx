/**
 * SessionGuard コンポーネントのテスト
 *
 * テスト対象: components/auth/session-guard.tsx
 *
 * SessionGuard は window.fetch をインターセプトし、
 * 401 レスポンスを検知したときにログアウト API 呼び出しと
 * ログインページへのリダイレクトを行う Client Component。
 */
import React from 'react'
import { render, act } from '@testing-library/react'
import { SessionGuard } from '@/components/auth/session-guard'

// next/navigation の useRouter をモック化
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}))

// テスト用ヘルパー: Response オブジェクトを生成する
function makeResponse(status: number): Response {
  return { status, ok: status >= 200 && status < 300 } as Response
}

describe('SessionGuard', () => {
  let originalFetch: typeof window.fetch

  beforeEach(() => {
    // 各テスト前にオリジナルの fetch を退避し、モックで上書きする
    originalFetch = window.fetch
    window.fetch = jest.fn()
    mockPush.mockClear()
    ;(window.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    // 各テスト後にオリジナルの fetch を復元する
    window.fetch = originalFetch
  })

  // ------------------------------------------------------------------
  // Given: SessionGuard がマウントされている
  // When:  401 レスポンスを返す API エンドポイントを fetch する
  // Then:  /api/auth/logout への POST が呼び出されること
  // ------------------------------------------------------------------
  it('401レスポンス時に /api/auth/logout を呼び出すこと', async () => {
    // SessionGuard が window.fetch を上書きする前の元 fetch をモック化
    const baseFetch = jest.fn()
    baseFetch
      .mockResolvedValueOnce(makeResponse(401)) // /api/some-protected のレスポンス
      .mockResolvedValue(makeResponse(200))     // /api/auth/logout のレスポンス
    window.fetch = baseFetch

    render(<SessionGuard />)

    // SessionGuard が window.fetch をインターセプト版に差し替えた後に呼び出す
    const intercepted = window.fetch
    await act(async () => {
      await intercepted('/api/some-protected', {})
    })

    // logout API が呼ばれていること
    expect(baseFetch).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' })
    )
  })

  // ------------------------------------------------------------------
  // Given: SessionGuard がマウントされている
  // When:  401 レスポンスを返す API エンドポイントを fetch する
  // Then:  router.push('/login') が呼び出されること
  // ------------------------------------------------------------------
  it('401レスポンス時に router.push("/login") を呼び出すこと', async () => {
    const baseFetch = jest.fn()
    baseFetch
      .mockResolvedValueOnce(makeResponse(401))
      .mockResolvedValue(makeResponse(200))
    window.fetch = baseFetch

    render(<SessionGuard />)

    const intercepted = window.fetch
    await act(async () => {
      await intercepted('/api/data', {})
    })

    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  // ------------------------------------------------------------------
  // Given: SessionGuard がマウントされている
  // When:  /api/auth/logout への fetch が 401 を返す
  // Then:  再帰的なログアウト呼び出しが発生しないこと（無限ループ防止）
  // ------------------------------------------------------------------
  it('/api/auth/logout への401レスポンスはインターセプトしないこと', async () => {
    const baseFetch = jest.fn()
    baseFetch.mockResolvedValue(makeResponse(401))
    window.fetch = baseFetch

    render(<SessionGuard />)

    const intercepted = window.fetch
    await act(async () => {
      await intercepted('/api/auth/logout', { method: 'POST' })
    })

    // logout エンドポイント自体に 401 が来ても、再度 logout は呼ばれない
    // baseFetch の呼び出しは /api/auth/logout の1回のみ
    expect(baseFetch).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Given: SessionGuard がマウントされており isRedirecting = false の状態
  // When:  401 レスポンスが連続して複数回発生する
  // Then:  router.push('/login') は1回だけ呼ばれること
  // ------------------------------------------------------------------
  it('複数の401が連続しても router.push が1回だけ呼ばれること', async () => {
    const baseFetch = jest.fn()
    baseFetch.mockResolvedValue(makeResponse(401))
    window.fetch = baseFetch

    render(<SessionGuard />)

    const intercepted = window.fetch
    await act(async () => {
      // 3回並列で 401 を発生させる
      await Promise.all([
        intercepted('/api/endpoint1', {}),
        intercepted('/api/endpoint2', {}),
        intercepted('/api/endpoint3', {}),
      ])
    })

    // isRedirecting フラグにより router.push は1回のみ
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  // ------------------------------------------------------------------
  // Given: SessionGuard がマウントされている
  // When:  200 レスポンスを返す API を fetch する
  // Then:  ログアウトがトリガーされないこと
  // ------------------------------------------------------------------
  it('200レスポンスはログアウトをトリガーしないこと', async () => {
    const baseFetch = jest.fn()
    baseFetch.mockResolvedValue(makeResponse(200))
    window.fetch = baseFetch

    render(<SessionGuard />)

    const intercepted = window.fetch
    await act(async () => {
      await intercepted('/api/data', {})
    })

    // 元の fetch は /api/data への1回のみ呼ばれる
    expect(baseFetch).toHaveBeenCalledTimes(1)
    expect(baseFetch).not.toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.anything()
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Given: SessionGuard がマウントされている
  // When:  コンポーネントをアンマウントする
  // Then:  window.fetch が元の実装に復元されること
  //
  // Note: 実装では window.fetch.bind(window) で元の fetch を保存するため、
  //       アンマウント後はバインド済み関数が復元される。
  //       復元を検証するため、アンマウント後に fetch を呼んだとき
  //       元のモック実装が呼び出されることを確認する。
  // ------------------------------------------------------------------
  it('コンポーネントのアンマウント時に元の window.fetch が復元されること', async () => {
    const baseFetch = jest.fn().mockResolvedValue(makeResponse(200))
    window.fetch = baseFetch

    const { unmount } = render(<SessionGuard />)

    // SessionGuard マウント後、fetch はインターセプト版に差し替えられている
    const interceptedFetch = window.fetch
    // インターセプト版は baseFetch とは異なる関数であること
    expect(interceptedFetch).not.toBe(baseFetch)

    // アンマウント後は元の fetch が呼び出せること
    unmount()
    await window.fetch('/test', {})
    // baseFetch が呼ばれている = 元の fetch に復元された証拠
    expect(baseFetch).toHaveBeenCalledWith('/test', {})
  })
})
