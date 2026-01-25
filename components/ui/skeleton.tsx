import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * 基本的なスケルトンコンポーネント
 * ローディング状態を表現するためのプレースホルダー
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="status"
      aria-label="読み込み中"
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
