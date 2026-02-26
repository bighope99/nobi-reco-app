"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle } from "lucide-react"

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

  if (loading || items.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-amber-800">
            前回の引継ぎ ({handoverDate})
          </h3>
          {items.map((item) => (
            <div key={item.activity_id} className="text-sm text-amber-900">
              <p className="whitespace-pre-wrap">{item.handover}</p>
              <p className="text-xs text-amber-600 mt-1">
                {item.class_name && `${item.class_name} / `}{item.created_by_name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
