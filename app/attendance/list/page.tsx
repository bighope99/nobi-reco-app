"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRole } from "@/hooks/useRole"
import { StaffLayout } from "@/components/layout/staff-layout"
import { formatTimeJST, getCurrentDateJST, getTomorrowDateJST } from "@/lib/utils/timezone"
import { normalizeSearch } from "@/lib/utils/kana"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Users,
  UserX,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Undo2,
  Check,
  X,
} from "lucide-react"
import {
  type ChildAttendance,
  type AttendanceData,
  type CancelAction,
  type TimeField,
  getStatusPresentation,
  getStatusAction,
  canDisplayTimeSetting,
  applyOptimisticStatusUpdate,
  applyOptimisticCancelUpdate,
  getCancelActions,
  isPastDate,
} from "./helpers"

// Status badge component
const StatusBadge = ({ child, currentDate }: { child: ChildAttendance; currentDate: string }) => {
  const presentation = getStatusPresentation(child, currentDate)

  if (!presentation) return null

  return <span className={presentation.className}>{presentation.label}</span>
}

// Status action button component
const StatusActionButton = ({
  child,
  currentDate,
  canCancel,
  onMarkStatus,
  isLoading,
}: {
  child: ChildAttendance
  currentDate: string
  canCancel: boolean
  onMarkStatus: (childId: string, status: 'absent' | 'present') => void
  isLoading: boolean
}) => {
  const action = getStatusAction(child, currentDate)

  if (!action) return null
  if (action === 'absent' && isPastDate(currentDate) && !canCancel) return null

  if (action === 'absent') {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => onMarkStatus(child.child_id, 'absent')}
        disabled={isLoading}
      >
        {isLoading ? '処理中...' : '欠席にする'}
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      onClick={() => onMarkStatus(child.child_id, 'present')}
      disabled={isLoading}
    >
      {isLoading ? '処理中...' : '出席にする'}
    </Button>
  )
}

const EditableTimeField = ({
  child,
  field,
  currentDate,
  canEditTime,
  isActionLoading,
  editingTime,
  timeLoading,
  formatTime,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  child: ChildAttendance
  field: TimeField
  currentDate: string
  canEditTime: boolean
  isActionLoading: boolean
  editingTime: { childId: string; field: TimeField; value: string } | null
  timeLoading: { childId: string; field: TimeField } | null
  formatTime: (dateString: string | null) => string
  onStartEdit: (childId: string, field: TimeField, value: string) => void
  onCommit: (childId: string, field: TimeField, value: string) => void
  onCancel: () => void
}) => {
  const timestamp = field === 'in' ? child.checked_in_at : child.checked_out_at
  const isEditing = editingTime?.childId === child.child_id && editingTime.field === field
  const isUpdating = timeLoading?.childId === child.child_id && timeLoading.field === field
  const settingVisible = canDisplayTimeSetting(child, field, currentDate, canEditTime) && !isActionLoading
  const textClassName = field === 'in' ? 'text-emerald-600' : 'text-slate-600'
  const editTitle = field === 'in' ? 'クリックして出席時刻を修正' : 'クリックして帰宅時刻を修正'
  const settingLabel = field === 'in' ? '出席時刻を設定' : '帰宅時刻を設定'
  const [localValue, setLocalValue] = useState<string>(timestamp ? formatTime(timestamp) : '')

  if (isUpdating) {
    return (
      <span className="inline-flex items-center gap-1 text-indigo-500">
        <span className="animate-spin h-3 w-3 border-2 border-indigo-400 border-t-transparent rounded-full"></span>
        <span className="text-xs">更新中</span>
      </span>
    )
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="time"
          aria-label={field === 'in' ? '出席時刻' : '帰宅時刻'}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="border border-indigo-300 rounded px-1 py-0.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (localValue) onCommit(child.child_id, field, localValue)
              else onCancel()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          autoFocus
        />
        <button
          type="button"
          onClick={() => { if (localValue) onCommit(child.child_id, field, localValue); else onCancel() }}
          className="p-2 text-green-600 hover:text-green-800"
          aria-label="確定"
          title="確定"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600"
          aria-label="キャンセル"
          title="キャンセル"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (timestamp) {
    return canEditTime && !isActionLoading ? (
      <button
        type="button"
        className={`${textClassName} font-medium hover:underline`}
        onClick={() => onStartEdit(child.child_id, field, formatTime(timestamp))}
        title={editTitle}
      >
        {formatTime(timestamp)}
      </button>
    ) : (
      <span className={`${textClassName} font-medium`}>{formatTime(timestamp)}</span>
    )
  }

  if (settingVisible) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        onClick={() => onStartEdit(child.child_id, field, '')}
        title={settingLabel}
      >
        設定
      </button>
    )
  }

  return <span className="text-slate-400">-</span>
}

// 取り消しボタンコンポーネント（施設管理者以上限定）
const CancelActionButtons = ({
  child,
  currentDate,
  canCancel,
  onCancel,
  isLoading,
}: {
  child: ChildAttendance
  currentDate: string
  canCancel: boolean
  onCancel: (childId: string, action: CancelAction) => void
  isLoading: boolean
}) => {
  if (!canCancel) return null

  const actions = getCancelActions(child, currentDate)
  if (actions.length === 0) return null

  return (
    <div className="flex gap-3 mt-1">
      {actions.includes('cancel_check_in') && (
        <button
          onClick={() => onCancel(child.child_id, 'cancel_check_in')}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-xs text-red-500 underline hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Undo2 size={12} />
          登園取消
        </button>
      )}
      {actions.includes('cancel_check_out') && (
        <button
          onClick={() => onCancel(child.child_id, 'cancel_check_out')}
          disabled={isLoading}
          className="inline-flex items-center gap-1 text-xs text-slate-400 underline hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Undo2 size={12} />
          降園取消
        </button>
      )}
    </div>
  )
}

export default function AttendanceListPage() {
  const { hasRole } = useRole()
  const canEditTime = hasRole('site_admin', 'company_admin', 'facility_admin')
  const canCancel = hasRole('site_admin', 'company_admin', 'facility_admin')

  // 初期値は空文字列にして、useEffectでクライアント側のみで設定
  // SSR時のタイムゾーン不一致を防ぐため
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState<{ childId: string; field: TimeField; value: string } | null>(null)
  const [timeLoading, setTimeLoading] = useState<{ childId: string; field: TimeField } | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'grade', order: 'desc' })
  const [inputSearchTerm, setInputSearchTerm] = useState('')
  const [committedSearchTerm, setCommittedSearchTerm] = useState('')
  const dateInputRef = useRef<HTMLInputElement>(null)

  // クライアント側でのみ初期日付を設定（マウント時のみ）
  // SSR時のタイムゾーン不一致を防ぐため、初期値は空文字列にして
  // useEffectでクライアント側のみで設定する
  useEffect(() => {
    setSelectedDate(getCurrentDateJST())
  }, [])

  const fetchAttendance = useCallback(async (silent = false) => {
    // 日付が設定されるまで待つ
    if (!selectedDate) return

    try {
      if (!silent) setLoading(true)
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
      if (!silent) setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  // 日付操作関数（環境のタイムゾーンに依存しない）
  const changeDate = (days: number) => {
    // 日付文字列から直接計算（ブラウザ依存を回避）
    const [year, month, day] = selectedDate.split('-').map(Number)
    const utcDate = new Date(Date.UTC(year, month - 1, day + days))
    const newYear = utcDate.getUTCFullYear()
    const newMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
    const newDay = String(utcDate.getUTCDate()).padStart(2, '0')
    setSelectedDate(`${newYear}-${newMonth}-${newDay}`)
  }

  const goToToday = () => {
    setSelectedDate(getCurrentDateJST())
  }

  const goToTomorrow = () => {
    setSelectedDate(getTomorrowDateJST())
  }

  const formatTime = (dateString: string | null) => {
    return formatTimeJST(dateString) || ''
  }

  const formatDisplayDate = (dateString: string) => {
    // 環境のタイムゾーンに依存しない曜日計算（API側のgetDayOfWeekKeyと同じ方式）
    const [year, month, day] = dateString.split('-').map(Number)
    const utcDate = new Date(Date.UTC(year, month - 1, day))
    const weekdayJp = ['日', '月', '火', '水', '木', '金', '土']
    const weekday = weekdayJp[utcDate.getUTCDay()]
    return `${month}月${day}日 (${weekday})`
  }

  // 検索ボタン押下時のみ検索を実行
  const handleSearch = () => {
    setCommittedSearchTerm(inputSearchTerm)
  }

  // Enterキーでも検索を実行（IME変換中のEnterは無視）
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // ソート切り替え
  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
      }
      return { key, order: key === 'grade' ? 'desc' : 'asc' }
    })
  }

  // クラスフィルター + 名前検索 + ソート適用
  const filteredChildren = useMemo(() => {
    if (!attendanceData) return []

    let data = attendanceData.children

    // クラスフィルター
    if (filterClass !== 'all') {
      data = data.filter(c => c.class_id === filterClass)
    }

    // 名前検索（ひらがな/カタカナ両対応）
    if (committedSearchTerm) {
      const normalizedTerm = normalizeSearch(committedSearchTerm).trim()
      data = data.filter(child =>
        normalizeSearch(child.name).includes(normalizedTerm) ||
        normalizeSearch(child.kana ?? '').includes(normalizedTerm)
      )
    }

    // ソート
    const sorted = [...data].sort((a, b) => {
      type SortValue = string | number
      const getSortValue = (child: ChildAttendance, key: string): SortValue => {
        switch (key) {
          case 'name':
            return normalizeSearch(child.kana ?? '')
          case 'grade':
            return child.grade ?? 0
          case 'class':
            return child.class_name ?? ''
          default:
            return ''
        }
      }

      const aValue = getSortValue(a, sortConfig.key)
      const bValue = getSortValue(b, sortConfig.key)

      if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1

      // セカンダリソート: かな順（あいうえお昇順）
      const aNorm = normalizeSearch(a.kana ?? '')
      const bNorm = normalizeSearch(b.kana ?? '')
      if (aNorm < bNorm) return -1
      if (aNorm > bNorm) return 1
      return 0
    })

    return sorted
  }, [attendanceData, filterClass, committedSearchTerm, sortConfig])

  // Current date for status presentation (use attendance data date if available, otherwise selected date)
  const currentDate = attendanceData?.date || selectedDate

  const handleStatusChange = async (childId: string, nextStatus: 'absent' | 'present') => {
    if (!attendanceData) return

    setActionError(null)
    setActionLoading(prev => ({ ...prev, [childId]: true }))

    // 楽観的更新: APIコール前にUIを即座に更新
    const previousData = attendanceData
    setAttendanceData(applyOptimisticStatusUpdate(attendanceData, childId, nextStatus, currentDate))

    try {
      const response = await fetch('/api/attendance/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          child_id: childId,
          date: selectedDate,
          status: nextStatus,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '出席ステータスの更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update attendance status:', err)
      // エラー時はロールバック
      setAttendanceData(previousData)
      setActionError(err instanceof Error ? err.message : '出席ステータスの更新に失敗しました')
      setActionLoading(prev => ({ ...prev, [childId]: false }))
      return
    }

    // API 成功後の再フェッチ（失敗してもロールバックしない）
    setActionLoading(prev => ({ ...prev, [childId]: false }))
    try {
      await fetchAttendance(true)
    } catch (fetchErr) {
      console.error('Failed to refresh attendance after status update:', fetchErr)
    }
  }

  const handleCancelAction = async (childId: string, cancelAction: CancelAction) => {
    if (!attendanceData) return

    setActionError(null)
    setActionLoading(prev => ({ ...prev, [childId]: true }))

    const previousData = attendanceData
    setAttendanceData(applyOptimisticCancelUpdate(attendanceData, childId, cancelAction))

    try {
      const response = await fetch('/api/attendance/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          date: selectedDate,
          status: cancelAction,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || '取消に失敗しました')
      }
    } catch (err) {
      console.error('Failed to cancel attendance:', err)
      setAttendanceData(previousData)
      setActionError(err instanceof Error ? err.message : '取消に失敗しました')
      setActionLoading(prev => ({ ...prev, [childId]: false }))
      return
    }

    // API 成功後の再フェッチ（失敗してもロールバックしない）
    setActionLoading(prev => ({ ...prev, [childId]: false }))
    try {
      await fetchAttendance(true)
    } catch (fetchErr) {
      console.error('Failed to refresh attendance after cancel:', fetchErr)
    }
  }

  const handleTimeEdit = async (childId: string, field: TimeField, timeValue: string) => {
    setActionError(null)
    setActionLoading(prev => ({ ...prev, [childId]: true }))
    setEditingTime(null)
    setTimeLoading({ childId, field })

    try {
      const dbField = field === 'in' ? 'checked_in_at' : 'checked_out_at'

      const response = await fetch('/api/attendance/time', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          date: selectedDate,
          field: dbField,
          time: timeValue,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '時刻の更新に失敗しました')
      }
    } catch (err) {
      console.error('Failed to update time:', err)
      setActionError(err instanceof Error ? err.message : '時刻の更新に失敗しました')
      setActionLoading(prev => ({ ...prev, [childId]: false }))
      setTimeLoading(null)
      return
    }

    // API 成功後の再フェッチ（失敗してもエラー扱いにしない）
    setActionLoading(prev => ({ ...prev, [childId]: false }))
    setTimeLoading(null)
    try {
      await fetchAttendance(true)
    } catch (fetchErr) {
      console.error('Failed to refresh attendance after time update:', fetchErr)
    }
  }

  if (loading) {
    return (
      <StaffLayout title="出席予定一覧">
        <div className="min-h-screen flex items-center justify-center">
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
        <div className="min-h-screen flex items-center justify-center">
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
      <div className="min-h-screen text-slate-900 font-sans">
        <div className="max-w-7xl mx-auto">

          {actionError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {/* Header with Date Selector */}
          <header className="flex flex-col gap-4 mb-6 border-b border-gray-200 pb-6">

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

                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="flex items-center gap-3 px-3 min-w-[200px] justify-center cursor-pointer hover:bg-gray-50 rounded transition-colors py-1 relative"
                  aria-label="日付を選択"
                >
                  <Calendar size={16} className="text-indigo-600" />
                  <span className="text-base font-bold text-slate-800">
                    {formatDisplayDate(selectedDate)}
                  </span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </button>

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
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors ${
                    selectedDate === getCurrentDateJST()
                      ? 'text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'
                      : 'text-slate-600 bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  今日
                </button>
                <button
                  onClick={goToTomorrow}
                  className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-colors ${
                    selectedDate === getTomorrowDateJST()
                      ? 'text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'
                      : 'text-slate-600 bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  明日
                </button>
              </div>
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
                <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">出席（遅刻含む）</h3>
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
              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
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
                <div className="flex gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="児童名・かな検索"
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={inputSearchTerm}
                      onChange={(e) => setInputSearchTerm(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    検索
                  </button>
                </div>
              </div>

              <span className="text-xs text-slate-500 self-end sm:self-center whitespace-nowrap">
                {filteredChildren.length} 名 表示
              </span>
            </div>

            {/* デスクトップ: テーブル表示 */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-white border-b border-gray-100 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort('name')}>
                      <span className="inline-flex items-center gap-1">
                        児童名
                        {sortConfig.key === 'name' && (sortConfig.order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </span>
                    </th>
                    <th className="px-5 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort('grade')}>
                      <span className="inline-flex items-center gap-1">
                        クラス / 学年
                        {sortConfig.key === 'grade' && (sortConfig.order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </span>
                    </th>
                    <th className="px-5 py-3 font-medium">ステータス</th>
                    <th className="px-5 py-3 font-medium text-center">操作</th>
                    <th className="px-5 py-3 font-medium">チェックイン時刻</th>
                    <th className="px-5 py-3 font-medium">チェックアウト時刻</th>
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
                      <td className="px-5 py-3"><StatusBadge child={child} currentDate={currentDate} /></td>
                      <td className="px-5 py-3 text-center">
                        <StatusActionButton
                          child={child}
                          currentDate={currentDate}
                          canCancel={canCancel}
                          onMarkStatus={handleStatusChange}
                          isLoading={Boolean(actionLoading[child.child_id])}
                        />
                        <CancelActionButtons
                          child={child}
                          currentDate={currentDate}
                          canCancel={canCancel}
                          onCancel={handleCancelAction}
                          isLoading={Boolean(actionLoading[child.child_id])}
                        />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <EditableTimeField
                          child={child}
                          field="in"
                          currentDate={currentDate}
                          canEditTime={canEditTime}
                          isActionLoading={Boolean(actionLoading[child.child_id])}
                          editingTime={editingTime}
                          timeLoading={timeLoading}
                          formatTime={formatTime}
                          onStartEdit={(childId, field, value) => setEditingTime({ childId, field, value })}
                          onCommit={handleTimeEdit}
                          onCancel={() => setEditingTime(null)}
                        />
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <EditableTimeField
                          child={child}
                          field="out"
                          currentDate={currentDate}
                          canEditTime={canEditTime}
                          isActionLoading={Boolean(actionLoading[child.child_id])}
                          editingTime={editingTime}
                          timeLoading={timeLoading}
                          formatTime={formatTime}
                          onStartEdit={(childId, field, value) => setEditingTime({ childId, field, value })}
                          onCommit={handleTimeEdit}
                          onCancel={() => setEditingTime(null)}
                        />
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
                      <StatusBadge child={child} currentDate={currentDate} />
                    </div>

                    <div className="mb-3">
                      <StatusActionButton
                        child={child}
                        currentDate={currentDate}
                        canCancel={canCancel}
                        onMarkStatus={handleStatusChange}
                        isLoading={Boolean(actionLoading[child.child_id])}
                      />
                      <CancelActionButtons
                        child={child}
                        currentDate={currentDate}
                        canCancel={canCancel}
                        onCancel={handleCancelAction}
                        isLoading={Boolean(actionLoading[child.child_id])}
                      />
                    </div>

                    {(child.checked_in_at ||
                      child.checked_out_at ||
                      canDisplayTimeSetting(child, 'in', currentDate, canEditTime) ||
                      canDisplayTimeSetting(child, 'out', currentDate, canEditTime)) && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-400 mb-1">チェックイン</div>
                          <div className="text-slate-600">
                            <EditableTimeField
                              child={child}
                              field="in"
                              currentDate={currentDate}
                              canEditTime={canEditTime}
                              isActionLoading={Boolean(actionLoading[child.child_id])}
                              editingTime={editingTime}
                              timeLoading={timeLoading}
                              formatTime={formatTime}
                              onStartEdit={(childId, field, value) => setEditingTime({ childId, field, value })}
                              onCommit={handleTimeEdit}
                              onCancel={() => setEditingTime(null)}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">チェックアウト</div>
                          <div className="text-slate-600">
                            <EditableTimeField
                              child={child}
                              field="out"
                              currentDate={currentDate}
                              canEditTime={canEditTime}
                              isActionLoading={Boolean(actionLoading[child.child_id])}
                              editingTime={editingTime}
                              timeLoading={timeLoading}
                              formatTime={formatTime}
                              onStartEdit={(childId, field, value) => setEditingTime({ childId, field, value })}
                              onCommit={handleTimeEdit}
                              onCancel={() => setEditingTime(null)}
                            />
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
