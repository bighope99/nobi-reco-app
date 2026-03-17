"use client"

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * グローバルな認証セッション監視コンポーネント
 * APIが401を返したとき、自動的にログアウトしてログインページへリダイレクトする
 */
export function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const isRedirectingRef = useRef(false)

  useEffect(() => {
    isRedirectingRef.current = false
  }, [pathname])

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    window.fetch = async function interceptedFetch(input, init) {
      const response = await originalFetch(input, init)

      const requestHeaders = init instanceof Headers ? init : new Headers(init?.headers)
      if (response.status === 401 && !isRedirectingRef.current && !requestHeaders.get('X-Skip-SessionGuard')) {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url

        // ログアウトAPI自体はインターセプトしない（無限ループ防止）
        if (!url.includes('/api/auth/logout')) {
          isRedirectingRef.current = true
          sessionStorage.removeItem('user_session')
          originalFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
          router.push('/login')
        }
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [router])

  return null
}
