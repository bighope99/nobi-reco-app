"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * グローバルな認証セッション監視コンポーネント
 * APIが401を返したとき、自動的にログアウトしてログインページへリダイレクトする
 */
export function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    let isRedirecting = false

    window.fetch = async function interceptedFetch(input, init) {
      const response = await originalFetch(input, init)

      if (response.status === 401 && !isRedirecting) {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url

        // ログアウトAPI自体はインターセプトしない（無限ループ防止）
        if (!url.includes('/api/auth/logout')) {
          isRedirecting = true
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
