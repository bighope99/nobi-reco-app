"use client"

import { useState, useEffect } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  CheckCircle2
} from "lucide-react"

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
  age_group: string
  grade: number | null
  grade_label: string
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
  // デフォルトの日付を明日に設定
  const getTomorrowDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const [selectedDate, setSelectedDate] = useState<string>(getTomorrowDate())
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState<string>('all')

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/attendance/list?date=${selectedDate}`)
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
  }, [selectedDate])

  // 日付操作関数
  const changeDate = (days: number) => {
    const currentDate = new Date(selectedDate)
    currentDate.setDate(currentDate.getDate() + days)
    setSelectedDate(currentDate.toISOString().split('T')[0])
  }

  const goToToday = () => {
    const today = new Date()
    setSelectedDate(today.toISOString().split('T')[0])
  }

  const goToTomorrow = () => {
    setSelectedDate(getTomorrowDate())
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdayJp = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdayJp[date.getDay()]
    return `${month}月${day}日 (${weekday})`
  }

  // 未来の日付かどうかを判定（今日より後）
  const isFutureDate = (dateString: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateString)
    targetDate.setHours(0, 0, 0, 0)
    return targetDate > today
  }

  // 出席ステータスを更新
  const updateAttendanceStatus = async (childId: string, status: 'scheduled' | 'absent') => {
    try {
      const response = await fetch('/api/attendance/daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          child_id: childId,
          date: selectedDate,
          status,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update attendance')
      }

      // データを再取得
      const fetchResponse = await fetch(`/api/attendance/list?date=${selectedDate}`)
      const fetchResult = await fetchResponse.json()

      if (fetchResponse.ok && fetchResult.success) {
        setAttendanceData(fetchResult.data)
      }
    } catch (err) {
      console.error('Failed to update attendance:', err)
      alert('出席状況の更新に失敗しました')
    }
  }

  // クラスフィルター適用
  const filteredChildren = attendanceData
    ? filterClass === 'all'
      ? attendanceData.children
      : attendanceData.children.filter(c => c.class_id === filterClass)
    : []

  // ステータスバッジコンポーネント
  const StatusBadge = ({ child }: { child: ChildAttendance }) => {
    const isFuture = isFutureDate(selectedDate)

    if (child.is_unexpected) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">予定外登園</span>
    }

    switch (child.status) {
      case 'present':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">出席</span>
      case 'late':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">遅刻</span>
      case 'absent':
        // 未来の日付の場合は「欠席予定」、過去/今日は「欠席」
        if (isFuture) {
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">欠席予定</span>
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">欠席</span>
      case 'not_arrived':
        if (child.is_expected) {
          // 未来の日付の場合は「出席予定」、過去/今日は「未到着」
          if (isFuture) {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">出席予定</span>
          }
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">未到着</span>
        }
        // 未来の日付の場合は「欠席予定」、過去/今日は「予定なし」
        if (isFuture) {
          return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">欠席予定</span>
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200">予定なし</span>
      default:
        return null
    }
  }

  // アクションボタンコンポーネント
  const ActionButton = ({ child }: { child: ChildAttendance }) => {
    const isFuture = isFutureDate(selectedDate)

    // 未来の日付でない場合はボタンを表示しない
    if (!isFuture) {
      return null
    }

    // 出席予定の人には欠席ボタン
    if (child.status === 'not_arrived' && child.is_expected) {
      return (
        <button
          onClick={() => updateAttendanceStatus(child.child_id, 'absent')}
          className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
        >
          欠席
        </button>
      )
    }

    // 欠席予定の人には出席ボタン
    if ((child.status === 'not_arrived' && !child.is_expected) || child.status === 'absent') {
      return (
        <button
          onClick={() => updateAttendanceStatus(child.child_id, 'scheduled')}
          className="px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded transition-colors"
        >
          出席
        </button>
      )
    }

    return null
  }

  if (loading) {
    return (
      <StaffLayout title="出席予定一覧">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">読み込み中...</p>
          </div>
        </div>
      </StaffLayout>
    )
  }

  if (error || !attendanceData) {
    return (
      <StaffLayout title="出席予定一覧">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="mt-4 text-slate-600">{error || 'データの取得に失敗しました'}</p>
          </div>
        </div>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="出席予定一覧">
      <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');`}
        </style>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

          {/* Header with Date Selector */}
          <header className="flex flex-col gap-4 mb-6 border-b border-gray-200 pb-6">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-slate-500 sm:w-5 sm:h-5" />
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">出席予定一覧</h1>
            </div>

            {/* Date Navigation */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
                <button
                  onClick={() => changeDate(-1)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  aria-label="前日"
                >
                  <ChevronLeft size={18} className="text-slate-600" />
                </button>

                <div className="flex items-center gap-3 px-3 min-w-[200px] justify-center">
                  <Calendar size={16} className="text-indigo-600" />
                  <span className="text-base font-bold text-slate-800">
                    {formatDisplayDate(selectedDate)}
                  </span>
                </div>

                <button
                  onClick={() => changeDate(1)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  aria-label="翌日"
                >
                  <ChevronRight size={18} className="text-slate-600" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={goToToday}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-sm transition-colors"
                >
                  今日
                </button>
                <button
                  onClick={goToTomorrow}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg shadow-sm transition-colors"
                >
                  明日
                </button>
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </header>

          {/* KPI Section */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">合計</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-slate-700">{attendanceData.summary.total_children}</span>
                <span className="text-xs text-slate-400">名</span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">出席</h3>
              </div>
              <div className="flex items-baseline gap-1 relative z-10">
                <span className="text-2xl sm:text-3xl font-bold text-emerald-700">{attendanceData.summary.present_count}</span>
                <span className="text-xs text-emerald-500">名</span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-orange-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-orange-600" />
                <h3 className="text-xs font-semibold text-orange-600 uppercase tracking-wider">遅刻</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-orange-700">{attendanceData.summary.late_count}</span>
                <span className="text-xs text-orange-500">名</span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <UserX size={16} className="text-slate-400" />
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">欠席</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-bold text-slate-700">{attendanceData.summary.absent_count}</span>
                <span className="text-xs text-slate-400">名</span>
              </div>
            </div>
          </div>

          {/* Attendance List */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-2 py-1.5">
                  <Filter size={14} className="text-slate-500" />
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="text-sm text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                  >
                    <option value="all">全クラス</option>
                    {attendanceData.filters.classes.map(cls => (
                      <option key={cls.class_id} value={cls.class_id}>{cls.class_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="text-xs text-slate-500 self-end sm:self-center">
                {filteredChildren.length} 名 表示
              </span>
            </div>

            {/* デスクトップ: テーブル表示 */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium">児童名</th>
                    <th className="px-5 py-3 font-medium">クラス / 学年</th>
                    <th className="px-5 py-3 font-medium">ステータス</th>
                    <th className="px-5 py-3 font-medium">チェックイン時刻</th>
                    <th className="px-5 py-3 font-medium">チェックアウト時刻</th>
                    <th className="px-5 py-3 font-medium">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredChildren.map(child => (
                    <tr key={child.child_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-bold text-slate-800">{child.name}</div>
                        <div className="text-xs text-slate-500">{child.kana}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-slate-700">{child.class_name}</div>
                        <div className="text-xs text-slate-500">{child.grade_label || '-'}</div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge child={child} /></td>
                      <td className="px-5 py-3 text-slate-600">
                        {child.checked_in_at ? (
                          <span className="text-emerald-600 font-medium">{formatTime(child.checked_in_at)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {child.checked_out_at ? (
                          <span className="text-slate-600 font-medium">{formatTime(child.checked_out_at)}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <ActionButton child={child} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* モバイル: カード表示 */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filteredChildren.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">該当する児童が見つかりませんでした</p>
                </div>
              ) : (
                filteredChildren.map(child => (
                  <div key={child.child_id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 mb-1">{child.name}</div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{child.class_name}</span>
                          <span>•</span>
                          <span>{child.grade_label || '-'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge child={child} />
                        <ActionButton child={child} />
                      </div>
                    </div>

                    {(child.checked_in_at || child.checked_out_at) && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-400 mb-1">チェックイン</div>
                          <div className="text-slate-600">
                            {child.checked_in_at ? (
                              <span className="text-emerald-600 font-medium">{formatTime(child.checked_in_at)}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">チェックアウト</div>
                          <div className="text-slate-600">
                            {child.checked_out_at ? (
                              <span className="font-medium">{formatTime(child.checked_out_at)}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </StaffLayout>
  )
}
