"use client"

import { useState, useEffect } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  present: { label: "出席", variant: "default" },
  absent: { label: "欠席", variant: "secondary" },
  late: { label: "遅刻", variant: "destructive" },
  not_arrived: { label: "未到着", variant: "outline" },
}

interface ChildAttendance {
  child_id: string
  name: string
  kana: string
  class_id: string | null
  class_name: string
  grade: string
  photo_url: string | null
  status: 'present' | 'absent' | 'late' | 'not_arrived'
  is_expected: boolean
  checked_in_at: string | null
  checked_out_at: string | null
  scan_method: string | null
  is_unexpected: boolean
}

interface AttendanceData {
  date: string
  weekday: string
  weekday_jp: string
  summary: {
    total_children: number
    present_count: number
    absent_count: number
    late_count: number
    not_checked_in_count: number
  }
  children: ChildAttendance[]
  filters: {
    classes: Array<{
      class_id: string
      class_name: string
      present_count: number
      total_count: number
    }>
  }
}

export default function AttendanceListPage() {
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/attendance/list')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch attendance')
        }

        if (result.success) {
          setAttendanceData(result.data)
        }
      } catch (err) {
        console.error('Failed to fetch attendance:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch attendance')
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [])

  const formatTime = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <StaffLayout
      title="出席児童一覧"
      subtitle={attendanceData ? `${attendanceData.date} (${attendanceData.weekday_jp})` : "本日の出席状況"}
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">エラー: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <p>読み込み中...</p>
          </div>
        ) : attendanceData && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">出席</p>
                  <p className="text-3xl font-bold text-primary">{attendanceData.summary.present_count}名</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">欠席</p>
                  <p className="text-3xl font-bold">{attendanceData.summary.absent_count}名</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">遅刻</p>
                  <p className="text-3xl font-bold text-orange-600">{attendanceData.summary.late_count}名</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">合計</p>
                  <p className="text-3xl font-bold">{attendanceData.summary.total_children}名</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>児童一覧</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceData.children.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p>児童が見つかりませんでした</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attendanceData.children.map((child) => (
                      <div
                        key={child.child_id}
                        className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {child.class_name}
                            {child.checked_in_at && ` • ${formatTime(child.checked_in_at)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {child.is_unexpected && (
                            <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                              予定外
                            </Badge>
                          )}
                          <Badge variant={statusLabels[child.status].variant}>
                            {statusLabels[child.status].label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </StaffLayout>
  )
}
