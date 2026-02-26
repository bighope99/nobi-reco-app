"use client"

import { useState, useEffect, useRef } from "react"
import { Clipboard } from "lucide-react"

interface HandoverItem {
  activity_id: string
  handover: string
  class_name: string
  created_by_name: string
}

interface PreviousHandoverBannerProps {
  activityDate: string
  selectedClass: string
}

export function PreviousHandoverBanner({ activityDate, selectedClass }: PreviousHandoverBannerProps) {
  const [handoverDate, setHandoverDate] = useState<string | null>(null)
  const [items, setItems] = useState<HandoverItem[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!activityDate) return

    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Set debounced timer (300ms)
    timerRef.current = setTimeout(() => {
      const fetchHandover = async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams({ date: activityDate })
          if (selectedClass) params.set("class_id", selectedClass)

          const response = await fetch(`/api/handover?${params}`)
          const result = await response.json()

          if (response.ok && result.success && result.data) {
            setHandoverDate(result.data.handover_date)
            setItems(result.data.items || [])
          } else {
            setHandoverDate(null)
            setItems([])
          }
        } catch (error) {
          console.error('Failed to fetch handover:', error)
          setHandoverDate(null)
          setItems([])
        } finally {
          setLoading(false)
        }
      }

      fetchHandover()
    }, 300)

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [activityDate, selectedClass])

  // ローディング中はスケルトン表示
  if (loading) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-orange-100 border-b border-orange-200">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-orange-200 animate-pulse" />
            <div className="h-4 w-20 rounded bg-orange-200 animate-pulse" />
          </div>
          <div className="h-4 w-24 rounded bg-orange-200 animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          <div className="h-4 w-3/4 rounded bg-orange-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-orange-100 animate-pulse" />
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 shadow-md overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-100 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <Clipboard className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <span className="text-sm font-bold text-orange-800">前回の引継ぎ</span>
        </div>
        <span className="text-xs font-medium text-orange-600">{handoverDate}</span>
      </div>
      {/* 引継ぎ内容 */}
      <div className="divide-y divide-orange-200">
        {items.map((item) => (
          <div key={item.activity_id} className="px-4 py-3">
            <p className="text-xs font-semibold text-orange-600 mb-1">
              {item.class_name && `${item.class_name} / `}{item.created_by_name}
            </p>
            <p className="text-sm text-orange-900 whitespace-pre-wrap">{item.handover}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
