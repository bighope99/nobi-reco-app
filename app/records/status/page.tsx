"use client"

import React, { useEffect, useMemo, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { FileText, ChevronLeft, Calendar, ChevronRight, ChevronDown, Search, Filter, History, ArrowUp, ArrowDown } from "lucide-react"


type RecordStatusChild = {
    child_id: string
    name: string
    kana: string
    class_id: string
    class_name: string
    grade: string
    photo_url: string
    last_record_date: string | null
    is_recorded_today: boolean
    monthly: {
        attendance_count: number
        record_count: number
        record_rate: number
        daily_status: ("present" | "absent" | "late" | "none")[]
    }
    yearly: {
        attendance_count: number
        record_count: number
        record_rate: number
    }
}

type RecordStatusResponse = {
    success: true
    data: {
        period: {
            year: number
            month: number
            start_date: string
            end_date: string
            days_in_month: number
        }
        children: RecordStatusChild[]
        summary: {
            total_children: number
            warning_children: number
            average_record_rate: number
        }
        filters: {
            classes: { class_id: string; class_name: string }[]
        }
    }
}

// --- Helper Components ---

const SortIcon = ({ colKey, currentSort }: { colKey: string, currentSort?: { key: string, order: 'asc' | 'desc' } }) => {
    if (!currentSort || currentSort.key !== colKey) {
        return <span className="ml-1 text-slate-300">↕</span>
    }
    return currentSort.order === 'asc' ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />
}

const LastRecordBadge = ({ dateStr }: { dateStr: string | null }) => {
    if (!dateStr) return <span className="text-xs text-slate-400">-</span>
    const date = new Date(dateStr)
    const isToday = new Date().toDateString() === date.toDateString()
    return (
        <span className={`text-xs px-2 py-1 rounded-full ${isToday ? 'bg-green-100 text-green-700 font-bold' : 'bg-slate-100 text-slate-600'}`}>
            {dateStr}
        </span>
    )
}

const ProgressBar = ({ value, max, mini = false }: { value: number, max: number, mini?: boolean }) => {
    const safeMax = max || 1
    const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100)) || 0
    const colorClass = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'

    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
                {!mini && <span className="font-medium">{percentage.toFixed(1)}%</span>}
                <span className="text-slate-500">{value}/{max}</span>
            </div>
            <div className={`w-full bg-slate-100 rounded-full ${mini ? 'h-1.5' : 'h-2.5'}`}>
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    )
}

const MonthlyHeatmap = ({ history }: { history: ('present' | 'absent' | 'late' | 'none')[] }) => {
    return (
        <div className="flex gap-0.5">
            {history.map((status, i) => {
                let color = 'bg-slate-100'
                if (status === 'present') color = 'bg-indigo-600'
                else if (status === 'absent') color = 'bg-slate-200'
                else if (status === 'late') color = 'bg-amber-400'

                return (
                    <div key={i} className={`w-2 h-4 rounded-sm ${color}`} title={`Day ${i + 1}: ${status}`} />
                )
            })}
        </div>
    )
}

const formatMonth = (year: number, month: number) => `${year}年 ${month}月`

const getSortValue = (child: RecordStatusChild, key: string) => {
    switch (key) {
        case 'name':
            return child.name
        case 'grade':
            return child.grade
        case 'class_name':
            return child.class_name
        case 'last_record_date':
            return child.last_record_date || ''
        case 'record_rate':
            return child.monthly.record_rate
        case 'yearly_record_rate':
            return child.yearly.record_rate
        default:
            return ''
    }
}

// --- Main Component ---

export default function StatusPage() {
    const today = new Date()
    const [year, setYear] = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth() + 1)
    const [selectedClass, setSelectedClass] = useState('All')
    const [searchTerm, setSearchTerm] = useState('')
    const [warningOnly, setWarningOnly] = useState(false)
    const [sortConfig, setSortConfig] = useState<{ key: string, order: 'asc' | 'desc' }>({ key: 'name', order: 'asc' })

    const [data, setData] = useState<RecordStatusResponse['data'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        const params = new URLSearchParams({ year: String(year), month: String(month) })
        if (selectedClass !== 'All') params.set('class_id', selectedClass)
        if (searchTerm) params.set('search', searchTerm)
        if (warningOnly) params.set('warning_only', 'true')

        setLoading(true)
        setError(null)

        fetch(`/api/records/status?${params.toString()}`, { signal: controller.signal })
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    throw new Error(body.error || '一覧の取得に失敗しました')
                }
                return res.json() as Promise<RecordStatusResponse>
            })
            .then((json) => {
                setData(json.data)
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError(err.message)
                }
            })
            .finally(() => {
                setLoading(false)
            })

        return () => controller.abort()
    }, [year, month, selectedClass, searchTerm, warningOnly])

    const sortedData = useMemo(() => {
        if (!data) return []
        const sorted = [...data.children]
        sorted.sort((a, b) => {
            const aValue = getSortValue(a, sortConfig.key)
            const bValue = getSortValue(b, sortConfig.key)

            if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1
            if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1
            return 0
        })
        return sorted
    }, [data, sortConfig])

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            order: current.key === key && current.order === 'asc' ? 'desc' : 'asc'
        }))
    }

    const goPrevMonth = () => {
        setMonth(prev => {
            if (prev === 1) {
                setYear((y) => y - 1)
                return 12
            }
            return prev - 1
        })
    }

    const goNextMonth = () => {
        setMonth(prev => {
            if (prev === 12) {
                setYear((y) => y + 1)
                return 1
            }
            return prev + 1
        })
    }

    const classOptions = data?.filters.classes ?? []
    const summary = data?.summary
    const period = data?.period

    return (
        <StaffLayout title="全児童 月間記録管理">
            {/* Title */}
            <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span>ホーム</span>
                    <span className="text-slate-300">/</span>
                    <span>日誌・記録管理</span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <FileText className="w-6 h-6 text-indigo-600" />
                    全児童 月間記録管理
                </h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400" onClick={goPrevMonth}>
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center text-sm font-bold text-slate-700 px-3">
                        <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                        {period ? formatMonth(period.year, period.month) : formatMonth(year, month)}
                    </div>
                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400" onClick={goNextMonth}>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">一括作成</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="py-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center gap-4 mt-4">
                <div className="relative min-w-[180px]">
                    <select
                        className="w-full appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="All">全クラス</option>
                        {classOptions.map(cls => (
                            <option key={cls.class_id} value={cls.class_id}>{cls.class_name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="児童名・かな検索"
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex-1"></div>

                <label className={`flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-all select-none ${warningOnly ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={warningOnly}
                            onChange={() => setWarningOnly(!warningOnly)}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                    </div>
                    <span className={`text-sm font-medium ${warningOnly ? 'text-rose-700' : 'text-slate-600'}`}>
                        記録率要注意のみ表示
                    </span>
                </label>
            </div>

            {error && (
                <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-sm">
                    {error}
                </div>
            )}

            {/* --- Main Table Section --- */}
            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {loading && (
                    <div className="text-center text-slate-500 py-10 text-sm">読み込み中...</div>
                )}

                {!loading && data && (
                    <>
                        {/* Table Stats */}
                        <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                            <div>
                                表示中: <span className="font-bold text-slate-900">{data.children.length}</span> 名
                                {warningOnly && <span className="ml-2 text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-xs font-bold">要確認対象</span>}
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-indigo-600 rounded-sm"></div> 記録済</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div> 記録なし(在所)</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-200 rounded-sm"></div> 休み</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 rounded-sm"></div> データなし</div>
                            </div>
                        </div>

                        {summary && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <div className="text-xs text-slate-500 mb-1">平均記録率</div>
                                    <div className="text-2xl font-bold text-slate-900">{summary.average_record_rate.toFixed(1)}%</div>
                                </div>
                                <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <div className="text-xs text-slate-500 mb-1">合計児童</div>
                                    <div className="text-2xl font-bold text-slate-900">{summary.total_children}名</div>
                                </div>
                                <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <div className="text-xs text-slate-500 mb-1">要注意</div>
                                    <div className="text-2xl font-bold text-rose-600">{summary.warning_children}名</div>
                                </div>
                            </div>
                        )}

                        {/* --- Scrollable Table Wrapper --- */}
                        <div className="w-full bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            {/* Sticky Column: Name Only */}
                                            <th
                                                scope="col"
                                                className="sticky left-0 z-20 bg-slate-50 px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[180px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => handleSort('name')}
                                            >
                                                氏名 <SortIcon colKey="name" currentSort={sortConfig} />
                                            </th>

                                            {/* New Column: Grade & Class */}
                                            <th
                                                scope="col"
                                                className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[160px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
                                                onClick={() => handleSort('grade')}
                                            >
                                                学年・クラス <SortIcon colKey="grade" currentSort={sortConfig} />
                                            </th>

                                            <th
                                                scope="col"
                                                className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[140px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
                                                onClick={() => handleSort('last_record_date')}
                                            >
                                                最終更新 <SortIcon colKey="last_record_date" currentSort={sortConfig} />
                                            </th>

                                            <th
                                                scope="col"
                                                className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[180px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
                                                onClick={() => handleSort('record_rate')}
                                            >
                                                月間記録率 <SortIcon colKey="record_rate" currentSort={sortConfig} />
                                            </th>

                                            <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[350px]">
                                                月間ヒートマップ(1日〜{period?.days_in_month ?? 31}日)
                                            </th>

                                            <th
                                                scope="col"
                                                className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[140px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
                                                onClick={() => handleSort('yearly_record_rate')}
                                            >
                                                年間割合 <SortIcon colKey="yearly_record_rate" currentSort={sortConfig} />
                                            </th>

                                            <th scope="col" className="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px]">
                                                アクション
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {sortedData.length > 0 ? (
                                            sortedData.map((child) => (
                                                <tr key={child.child_id} className="hover:bg-slate-50 transition-colors group">

                                                    {/* Sticky Column: Name */}
                                                    <td className="sticky left-0 z-20 bg-white px-6 py-4 whitespace-nowrap shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 transition-colors">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-900">{child.name}</span>
                                                            <span className="text-xs text-slate-400">{child.kana}</span>
                                                        </div>
                                                    </td>

                                                    {/* Grade & Class */}
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-slate-900">{child.grade}</span>
                                                            <span className="text-xs text-slate-500">{child.class_name}</span>
                                                        </div>
                                                    </td>

                                                    {/* Last Record */}
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <LastRecordBadge dateStr={child.last_record_date} />
                                                    </td>

                                                    {/* Monthly Stats */}
                                                    <td className="px-4 py-4 whitespace-nowrap align-middle">
                                                        <ProgressBar value={child.monthly.record_count} max={child.monthly.attendance_count} />
                                                    </td>

                                                    {/* Monthly Heatmap */}
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <MonthlyHeatmap history={child.monthly.daily_status} />
                                                    </td>

                                                    {/* Yearly Rate (New) */}
                                                    <td className="px-4 py-4 whitespace-nowrap align-middle">
                                                        <ProgressBar value={child.yearly.record_count} max={child.yearly.attendance_count} mini={true} />
                                                    </td>

                                                    {/* Actions (Always Visible) */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors" title="履歴">
                                                                <History className="w-4 h-4" />
                                                            </button>
                                                            <button className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all">
                                                                作成
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Filter className="w-8 h-8 text-slate-300" />
                                                        <span className="text-sm">条件に一致する児童はいません</span>
                                                        <button
                                                            onClick={() => { setSearchTerm(''); setWarningOnly(false); setSelectedClass('All'); }}
                                                            className="text-indigo-600 text-sm hover:underline mt-1"
                                                        >
                                                            フィルターをリセット
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </StaffLayout>
    )
}
