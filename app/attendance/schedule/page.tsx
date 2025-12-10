"use client"

import { useState, useEffect } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

const weekdays = [
  { key: 'monday', label: '月' },
  { key: 'tuesday', label: '火' },
  { key: 'wednesday', label: '水' },
  { key: 'thursday', label: '木' },
  { key: 'friday', label: '金' },
]

interface ChildSchedule {
  child_id: string
  name: string
  kana: string
  class_id: string | null
  class_name: string
  grade: string
  photo_url: string | null
  schedule: {
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  updated_at: string | null
}

interface ScheduleData {
  children: ChildSchedule[]
  total: number
}

export default function AttendanceSchedulePage() {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/attendance/schedules')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch schedules')
        }

        if (result.success) {
          setScheduleData(result.data)
        }
      } catch (err) {
        console.error('Failed to fetch schedules:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch schedules')
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [])

  return (
    <StaffLayout title="出席予定登録" subtitle="曜日ベースの通所設定">
      <Card>
        <CardHeader>
          <CardTitle>通所予定設定</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-600 text-sm">エラー: {error}</p>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <p>読み込み中...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium">名前</th>
                    <th className="px-4 py-3 text-left font-medium">クラス</th>
                    {weekdays.map((day) => (
                      <th key={day.key} className="px-4 py-3 text-center font-medium">
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scheduleData?.children.map((child) => (
                    <tr key={child.child_id} className="border-b border-border hover:bg-slate-50">
                      <td className="px-4 py-3">{child.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{child.class_name}</td>
                      {weekdays.map((day) => (
                        <td key={day.key} className="px-4 py-3 text-center">
                          <Checkbox
                            checked={child.schedule[day.key as keyof typeof child.schedule]}
                            disabled
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {scheduleData?.children.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <p>児童が見つかりませんでした</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </StaffLayout>
  )
}
