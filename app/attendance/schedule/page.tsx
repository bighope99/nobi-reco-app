"use client"

import { useState, useEffect, useMemo } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Filter,
  Calendar,
  ArrowUpDown,
  Save,
  AlertTriangle,
  Users,
  CheckCircle2,
  RotateCcw
} from "lucide-react"

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

type SortKey = 'name' | 'class' | 'grade'
type SortOrder = 'asc' | 'desc'

export default function AttendanceSchedulePage() {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClass, setFilterClass] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [editMode, setEditMode] = useState(false)
  const [modifiedSchedules, setModifiedSchedules] = useState<Map<string, ChildSchedule['schedule']>>(new Map())
  const [saving, setSaving] = useState(false)

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

  // Get unique class options
  const classOptions = useMemo(() => {
    if (!scheduleData) return []
    const classes = new Map<string, string>()
    scheduleData.children.forEach(child => {
      if (child.class_id && child.class_name) {
        classes.set(child.class_id, child.class_name)
      }
    })
    return Array.from(classes.entries()).map(([id, name]) => ({ class_id: id, class_name: name }))
  }, [scheduleData])

  // Filter and sort data
  const processedData = useMemo(() => {
    if (!scheduleData) return []

    let result = [...scheduleData.children]

    // Filter by search term
    if (searchTerm) {
      result = result.filter(child =>
        child.name.includes(searchTerm) ||
        child.kana.includes(searchTerm)
      )
    }

    // Filter by class
    if (filterClass !== 'all') {
      result = result.filter(child => child.class_id === filterClass)
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortKey) {
        case 'name':
          comparison = a.kana.localeCompare(b.kana)
          break
        case 'class':
          comparison = a.class_name.localeCompare(b.class_name)
          break
        case 'grade':
          comparison = a.grade.localeCompare(b.grade)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [scheduleData, searchTerm, filterClass, sortKey, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown size={12} className="text-slate-300 opacity-50" />
    }
    return (
      <ArrowUpDown
        size={12}
        className={`text-indigo-600 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
      />
    )
  }

  const handleCheckboxChange = (childId: string, dayKey: keyof ChildSchedule['schedule'], currentValue: boolean) => {
    if (!editMode) return

    const child = scheduleData?.children.find(c => c.child_id === childId)
    if (!child) return

    const currentModified = modifiedSchedules.get(childId) || { ...child.schedule }
    const newSchedule = { ...currentModified, [dayKey]: !currentValue }

    setModifiedSchedules(new Map(modifiedSchedules.set(childId, newSchedule)))
  }

  const getCurrentSchedule = (childId: string): ChildSchedule['schedule'] => {
    const modified = modifiedSchedules.get(childId)
    if (modified) return modified

    const child = scheduleData?.children.find(c => c.child_id === childId)
    return child?.schedule || {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    }
  }

  const handleSave = async () => {
    if (modifiedSchedules.size === 0) {
      setEditMode(false)
      return
    }

    setSaving(true)
    try {
      // 変更された予定をAPI形式に変換
      const updates = Array.from(modifiedSchedules.entries()).map(([child_id, schedule]) => ({
        child_id,
        schedule,
      }))

      // APIを呼び出して一括更新
      const response = await fetch('/api/attendance/schedules/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save schedules')
      }

      // 保存成功時の処理
      if (result.data.failed_count > 0) {
        alert(`保存しました（${result.data.updated_count}件成功、${result.data.failed_count}件失敗）`)
      } else {
        alert(`保存しました（${result.data.updated_count}件更新）`)
      }

      // ローカル状態を更新
      if (scheduleData) {
        const updatedChildren = scheduleData.children.map(child => {
          const modified = modifiedSchedules.get(child.child_id)
          if (modified) {
            return { ...child, schedule: modified }
          }
          return child
        })
        setScheduleData({ ...scheduleData, children: updatedChildren })
      }

      setModifiedSchedules(new Map())
      setEditMode(false)
    } catch (err) {
      console.error('Failed to save schedules:', err)
      alert(`保存に失敗しました: ${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setModifiedSchedules(new Map())
    setEditMode(false)
  }

  return (
    <StaffLayout title="出席予定登録" subtitle="曜日ベースの通所設定">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-indigo-500" />
                出席予定登録
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {loading ? '読み込み中...' : `全 ${scheduleData?.total || 0} 名の通所予定を管理`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {editMode ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg transition-colors font-bold text-sm disabled:opacity-50"
                  >
                    <RotateCcw size={18} />
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        保存
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors font-bold text-sm"
                >
                  <Users size={18} />
                  編集モード
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="名前・かな検索..."
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Class Filter */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full md:w-auto">
              <Filter size={16} className="text-slate-400" />
              <select
                className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 cursor-pointer p-0 min-w-[120px]"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
              >
                <option value="all">全クラス</option>
                {classOptions.map(cls => (
                  <option key={cls.class_id} value={cls.class_id}>{cls.class_name}</option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <div className="text-sm text-slate-500">
              表示中: <span className="font-bold text-slate-900">{processedData.length}</span> 名
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertTriangle className="text-red-600 shrink-0" size={20} />
              <p className="text-red-600 text-sm">エラー: {error}</p>
            </div>
          )}

          {/* Edit Mode Notice */}
          {editMode && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <CheckCircle2 className="text-indigo-600 shrink-0" size={20} />
              <p className="text-indigo-700 text-sm font-medium">
                編集モード: チェックボックスをクリックして予定を変更できます
              </p>
            </div>
          )}

          {/* Table Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-slate-600">読み込み中...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th
                        className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          児童名
                          <SortIcon columnKey="name" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                        onClick={() => handleSort('grade')}
                      >
                        <div className="flex items-center gap-1">
                          学年
                          <SortIcon columnKey="grade" />
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none group"
                        onClick={() => handleSort('class')}
                      >
                        <div className="flex items-center gap-1">
                          クラス
                          <SortIcon columnKey="class" />
                        </div>
                      </th>
                      {weekdays.map((day) => (
                        <th key={day.key} className="px-4 py-3 text-center font-semibold text-slate-600 text-sm">
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processedData.map((child) => {
                      const currentSchedule = getCurrentSchedule(child.child_id)
                      const hasChanges = modifiedSchedules.has(child.child_id)

                      return (
                        <tr
                          key={child.child_id}
                          className={`transition-colors ${hasChanges ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-bold text-base text-slate-800">
                                {child.name}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 font-mono">
                                {child.kana}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-slate-700">{child.grade}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600">{child.class_name}</span>
                          </td>
                          {weekdays.map((day) => (
                            <td key={day.key} className="px-4 py-4 text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={currentSchedule[day.key as keyof typeof currentSchedule]}
                                  disabled={!editMode}
                                  onCheckedChange={() =>
                                    handleCheckboxChange(
                                      child.child_id,
                                      day.key as keyof ChildSchedule['schedule'],
                                      currentSchedule[day.key as keyof typeof currentSchedule]
                                    )
                                  }
                                  className={editMode ? 'cursor-pointer' : 'cursor-not-allowed'}
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {processedData.length === 0 && (
                  <div className="p-12 text-center">
                    <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">条件に一致する児童は見つかりませんでした</p>
                    <button
                      onClick={() => { setSearchTerm(''); setFilterClass('all'); }}
                      className="text-indigo-600 text-sm hover:underline mt-2"
                    >
                      フィルターをリセット
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </StaffLayout>
  )
}
