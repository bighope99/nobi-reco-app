"use client"

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SESSION_STORAGE_KEY } from '@/lib/auth/session'

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

      const baseHeaders = input instanceof Request ? input.headers : undefined
      const requestHeaders = new Headers(baseHeaders)
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
          requestHeaders.set(key, value)
        })
      }
      if (response.status === 401 && !isRedirectingRef.current && !requestHeaders.get('X-Skip-SessionGuard')) {
        const rawUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url
        const url = new URL(rawUrl, window.location.origin)

        // ログアウトAPI自体はインターセプトしない（無限ループ防止）
        const isLogoutApi = url.pathname === '/api/auth/logout'
        if (!isLogoutApi) {
          isRedirectingRef.current = true
          sessionStorage.removeItem(SESSION_STORAGE_KEY)
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
