import * as React from 'react'

import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'

interface PageSkeletonProps {
  /** ヘッダー（タイトル）を表示するか */
  showHeader?: boolean
  /** コンテンツカードの数 */
  cardCount?: number
  /** 追加のクラス名 */
  className?: string
}

/**
 * 汎用的なページローディング用スケルトンUIコンポーネント
 *
 * @example
 * // デフォルト使用
 * <PageSkeleton />
 *
 * @example
 * // カスタマイズ
 * <PageSkeleton showHeader={false} cardCount={5} />
 */
function PageSkeleton({
  showHeader = true,
  cardCount = 3,
  className,
}: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* ヘッダー部分 */}
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      )}

      {/* コンテンツカード部分 */}
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  )
}

/**
 * カード風のスケルトンコンポーネント
 */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm space-y-4',
        className,
      )}
    >
      {/* カードヘッダー */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* カードコンテンツ */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

/**
 * テーブル用スケルトンコンポーネント
 */
function TableSkeleton({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      {/* テーブルヘッダー */}
      <div className="flex gap-4 p-4 border-b bg-muted/50">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>

      {/* テーブル行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b last:border-b-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export { PageSkeleton, SkeletonCard, TableSkeleton }
