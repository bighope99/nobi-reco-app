'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// 00:00 〜 23:55 の5分刻み候補
const TIME_OPTIONS: string[] = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = Math.floor(i / 12).toString().padStart(2, '0')
  const m = ((i % 12) * 5).toString().padStart(2, '0')
  return `${h}:${m}`
})

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function findClosestIndex(hh: string, mm: string): number {
  const h = parseInt(hh, 10)
  const m = parseInt(mm, 10)
  if (isNaN(h) || isNaN(m)) return 0
  const minutes = h * 60 + m
  let closest = 0
  let minDiff = Infinity
  TIME_OPTIONS.forEach((opt, i) => {
    const [oh, om] = opt.split(':').map(Number)
    const diff = Math.abs(oh * 60 + om - minutes)
    if (diff < minDiff) {
      minDiff = diff
      closest = i
    }
  })
  return closest
}

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hh, setHh] = React.useState(() => value.split(':')[0] ?? '10')
  const [mm, setMm] = React.useState(() => value.split(':')[1] ?? '00')
  const [open, setOpen] = React.useState(false)

  const listRef = React.useRef<HTMLUListElement>(null)

  // 親から value が変わったら同期
  React.useEffect(() => {
    const parts = value.split(':')
    setHh(parts[0] ?? '10')
    setMm(parts[1] ?? '00')
  }, [value])

  // ドロップダウンが開いたら現在値に近い候補にスクロール
  // Portal経由レンダリングのため requestAnimationFrame で1フレーム待つ
  React.useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      if (!listRef.current) return
      const idx = findClosestIndex(hh, mm)
      const container = listRef.current
      const li = container.children[idx] as HTMLElement | undefined
      if (li) {
        container.scrollTop = li.offsetTop - container.clientHeight / 2 + li.clientHeight / 2
      }
    })
  }, [open, hh, mm])

  function handleHourBlur() {
    const h = clamp(parseInt(hh, 10) || 0, 0, 23).toString().padStart(2, '0')
    setHh(h)
    onChange(`${h}:${mm}`)
  }

  function handleMinuteBlur() {
    const m = clamp(parseInt(mm, 10) || 0, 0, 59).toString().padStart(2, '0')
    setMm(m)
    onChange(`${hh}:${m}`)
  }

  function handleSelect(opt: string) {
    const [h, m] = opt.split(':')
    setHh(h)
    setMm(m)
    onChange(opt)
    setOpen(false)
  }

  const closestIdx = findClosestIndex(hh, mm)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* 時/分フィールド + ▼ボタンを一体化 */}
      <div className={cn('flex h-9 items-center rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]', className)}>
        <input
          type="text"
          inputMode="numeric"
          value={hh}
          onChange={(e) => setHh(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onFocus={(e) => e.target.select()}
          onBlur={handleHourBlur}
          maxLength={2}
          aria-label="時"
          className="w-6 bg-transparent text-center outline-none"
        />
        <span className="select-none text-muted-foreground">:</span>
        <input
          type="text"
          inputMode="numeric"
          value={mm}
          onChange={(e) => setMm(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onFocus={(e) => e.target.select()}
          onBlur={handleMinuteBlur}
          maxLength={2}
          aria-label="分"
          className="w-6 bg-transparent text-center outline-none"
        />
        {/* ▼ボタン（PopoverTrigger） */}
        <PopoverTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            className="ml-1 flex items-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="時刻候補を表示"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent
        className="w-28 overflow-hidden p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ul
          ref={listRef}
          role="listbox"
          className="max-h-48 overflow-y-auto overscroll-contain"
        >
          {TIME_OPTIONS.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === closestIdx}
              onClick={() => handleSelect(opt)}
              className={cn(
                'cursor-pointer px-3 py-1.5 text-sm',
                i === closestIdx
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {opt}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
