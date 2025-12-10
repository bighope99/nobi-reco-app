"use client"

import { useEffect, useMemo, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Calendar, RefreshCw, Search, Users } from "lucide-react"

import type { AttendanceStatus } from "@/types/attendance"

type AttendanceChild = {
  child_id: string
  name: string
  kana: string
  class_id: string
  class_name: string
  grade: string
  status: AttendanceStatus
  is_expected: boolean
  is_unexpected: boolean
  checked_in_at: string | null
  checked_out_at: string | null
  scan_method: "manual" | "qr" | "nfc" | null
}

type AttendanceResponse = {
  success: boolean
  data?: {
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
    children: AttendanceChild[]
    filters: {
      classes: { class_id: string; class_name: string; present_count: number; total_count: number }[]
    }
  }
  error?: string
}

const statusStyle: Record<AttendanceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  present: { label: "出席", variant: "default" },
  absent: { label: "欠席", variant: "secondary" },
  late: { label: "遅刻", variant: "destructive" },
  not_arrived: { label: "未到着", variant: "outline" },
}

export default function AttendanceListPage() {
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<"all" | AttendanceStatus>("all")
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AttendanceResponse["data"] | null>(null)

  const fetchAttendance = async () => {
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set("date", date)
    if (selectedClass !== "all") params.set("class_id", selectedClass)
    if (selectedStatus !== "all") params.set("status", selectedStatus)
    if (search.trim()) params.set("search", search.trim())

    const res = await fetch(`/api/attendance/list?${params.toString()}`)
    const json: AttendanceResponse = await res.json()

    if (!res.ok || !json.success) {
      setError(json.error || "データの取得に失敗しました")
      setData(null)
    } else {
      setData(json.data ?? null)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    fetchAttendance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedClass, selectedStatus, search])

  const sortedChildren = useMemo(() => {
    if (!data) return []
    return [...data.children].sort((a, b) => a.class_name.localeCompare(b.class_name) || a.kana.localeCompare(b.kana))
  }, [data])

  return (
    <StaffLayout title="出席児童一覧" subtitle="本日の出席状況">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>本日の出席状況</CardTitle>
              {data && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.date}（{data.weekday_jp}） 時点
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  className="bg-transparent text-sm focus:outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchAttendance} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                再取得
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile label="出席" value={data?.summary.present_count ?? 0} highlight />
                <SummaryTile label="欠席" value={data?.summary.absent_count ?? 0} />
                <SummaryTile label="遅刻" value={data?.summary.late_count ?? 0} />
                <SummaryTile label="未到着" value={data?.summary.not_checked_in_count ?? 0} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>絞り込み</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>クラス</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="全クラス" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全クラス</SelectItem>
                    {data?.filters.classes.map((cls) => (
                      <SelectItem key={cls.class_id} value={cls.class_id}>
                        {cls.class_name}（{cls.present_count}/{cls.total_count}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ステータス</Label>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as AttendanceStatus | "all")} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="present">出席</SelectItem>
                    <SelectItem value="absent">欠席</SelectItem>
                    <SelectItem value="late">遅刻</SelectItem>
                    <SelectItem value="not_arrived">未到着</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>検索</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="名前・かなで検索"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>児童一覧</CardTitle>
            {data && (
              <p className="text-sm text-muted-foreground">
                {data.summary.total_children}名表示
              </p>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">読込中...</p>
            ) : sortedChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">該当する児童がいません</p>
            ) : (
              <div className="space-y-3">
                {sortedChildren.map((child) => (
                  <div
                    key={child.child_id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{child.name}</p>
                        <Badge variant={statusStyle[child.status].variant}>{statusStyle[child.status].label}</Badge>
                        {!child.is_expected && <Badge variant="outline">予定外</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{child.class_name} / {child.grade}</p>
                      <p className="text-xs text-muted-foreground">かな: {child.kana}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {child.is_expected ? "出席予定" : "出席予定なし"}
                        </span>
                        <span>チェックイン: {child.checked_in_at ? new Date(child.checked_in_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                        <span>チェックアウト: {child.checked_out_at ? new Date(child.checked_out_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                        <span>方法: {child.scan_method ? child.scan_method.toUpperCase() : "未登録"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}

function SummaryTile({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}名</p>
    </div>
  )
}
