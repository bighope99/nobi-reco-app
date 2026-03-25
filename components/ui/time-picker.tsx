'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// 00:00 〜 23:55 の5分刻み候補
const TIME_OPTIONS: string[] = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = Math.floor(i / 12).toString().padStart(2, '0')
  const m = ((i % 12) * 5).toString().padStart(2, '0')
  return `${h}:${m}`
})

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value)
}

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [inputValue, setInputValue] = React.useState(value)
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 親から value が変わったら同期
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  // ドロップダウンが開いたら現在値に近い候補にスクロール
  React.useEffect(() => {
    if (!open || !listRef.current) return
    const idx = findClosestIndex(inputValue)
    const li = listRef.current.children[idx] as HTMLElement | undefined
    if (li) {
      li.scrollIntoView({ block: 'nearest' })
    }
  }, [open, inputValue])

  // 外側クリックで閉じる
  React.useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function findClosestIndex(val: string): number {
    if (!isValidTime(val)) return 0
    const [h, m] = val.split(':').map(Number)
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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value)
  }

  function handleInputBlur() {
    if (isValidTime(inputValue)) {
      onChange(inputValue)
    } else {
      // 不正値はリセット
      setInputValue(value)
    }
  }

  function handleSelect(opt: string) {
    setInputValue(opt)
    onChange(opt)
    setOpen(false)
    inputRef.current?.focus()
  }

  const closestIdx = findClosestIndex(inputValue)

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setOpen(true)}
          placeholder="HH:MM"
          maxLength={5}
          aria-invalid={inputValue !== '' && !isValidTime(inputValue)}
          className={cn(
            'h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:border-destructive',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onPointerDown={(e) => {
            e.preventDefault()
            setOpen((prev) => !prev)
            inputRef.current?.focus()
          }}
          className="ml-[-1px] flex h-9 items-center rounded-r-md border border-l-0 border-input bg-transparent px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="時刻候補を表示"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-28 overflow-y-auto rounded-md border border-input bg-popover shadow-md"
        >
          {TIME_OPTIONS.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              onPointerDown={(e) => {
                e.preventDefault()
                handleSelect(opt)
              }}
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
      )}
    </div>
  )
}
