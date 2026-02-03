"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText, ChevronLeft, Calendar, ChevronRight, ChevronDown, Search, Filter, History, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react"
import { replaceChildIdsWithNames } from "@/lib/ai/childIdFormatter"
import { getCurrentDateJST } from "@/lib/utils/timezone"

// --- Types ---
interface Child {
    child_id: string;
    name: string;
    kana: string;
    class_id: string | null;
    class_name: string;
    age_group: string;
    grade: number | null;
    grade_label: string;
    photo_url: string | null;
    last_record_date: string | null;
    is_recorded_today: boolean;
    monthly: {
        attendance_count: number;
        record_count: number;
        record_rate: number;
        daily_status: string[];
    };
    yearly: {
        attendance_count: number;
        record_count: number;
        record_rate: number;
    };
}

interface RecordsData {
    period: {
        year: number;
        month: number;
        start_date: string;
        end_date: string;
        days_in_month: number;
    };
    children: Child[];
    summary: {
        total_children: number;
        warning_children: number;
        average_record_rate: number;
    };
    filters: {
        classes: Array<{ class_id: string; class_name: string }>;
    };
}

interface HistoryRecord {
    id: string;
    observation_date: string;
    content: string;
    created_at: string;
    tag_ids?: string[];
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
    // JSTベースで「今日」判定（環境のタイムゾーンに依存しない）
    const todayJST = getCurrentDateJST()
    const isToday = dateStr === todayJST
    return (
        <span className={`text-xs px-2 py-1 rounded-full ${isToday ? 'bg-green-100 text-green-700 font-bold' : 'bg-slate-100 text-slate-600'}`}>
            {dateStr}
        </span>
    )
}

const ProgressBar = ({ value, max, mini = false }: { value: number, max: number, mini?: boolean }) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100)) || 0
    const colorClass = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'

    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
                {!mini && <span className="font-medium">{percentage.toFixed(0)}%</span>}
                <span className="text-slate-500">{value}/{max}</span>
            </div>
            <div className={`w-full bg-slate-100 rounded-full ${mini ? 'h-1.5' : 'h-2.5'}`}>
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    )
}

const MonthlyHeatmap = ({ history }: { history: string[] }) => {
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

// --- Main Component ---

export default function StatusPage() {
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [recordsData, setRecordsData] = useState<RecordsData | null>(null)

    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [selectedClass, setSelectedClass] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [warningOnly, setWarningOnly] = useState(false)
    const [sortConfig, setSortConfig] = useState<{ key: string, order: 'asc' | 'desc' }>({ key: 'name', order: 'asc' })

    // 履歴モーダル用の状態
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [selectedChildForHistory, setSelectedChildForHistory] = useState<Child | null>(null)
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([])
    const [historyError, setHistoryError] = useState<string | null>(null)

    // データ取得
    useEffect(() => {
        const fetchRecordsData = async () => {
            try {
                setLoading(true)
                const params = new URLSearchParams({
                    year: year.toString(),
                    month: month.toString(),
                    warning_only: warningOnly.toString(),
                })

                if (selectedClass !== 'all') {
                    params.append('class_id', selectedClass)
                }

                if (searchTerm) {
                    params.append('search', searchTerm)
                }

                const response = await fetch(`/api/records/status?${params}`)

                if (!response.ok) {
                    throw new Error('Failed to fetch records data')
                }

                const result = await response.json()
                if (result.success) {
                    setRecordsData(result.data)
                } else {
                    throw new Error(result.error || 'Unknown error')
                }
            } catch (err) {
                console.error('Records fetch error:', err)
                setError(err instanceof Error ? err.message : 'Failed to load records')
            } finally {
                setLoading(false)
            }
        }

        fetchRecordsData()
    }, [year, month, selectedClass, searchTerm, warningOnly])

    // 月の変更
    const changeMonth = (delta: number) => {
        let newMonth = month + delta
        let newYear = year

        if (newMonth > 12) {
            newMonth = 1
            newYear++
        } else if (newMonth < 1) {
            newMonth = 12
            newYear--
        }

        setYear(newYear)
        setMonth(newMonth)
    }

    type SortValue = string | number;

    const getSortValue = (child: Child, key: string): SortValue => {
        switch (key) {
            case 'name':
                return child.kana;
            case 'grade':
                return child.grade ?? 0;
            case 'last_record_date':
                return child.last_record_date || '';
            case 'record_rate':
                return child.monthly.record_rate;
            case 'yearly_rate':
                return child.yearly.record_rate;
            default:
                return '';
        }
    };

    const sortedData = useMemo(() => {
        if (!recordsData) return []

        const sorted = [...recordsData.children]
        sorted.sort((a, b) => {
            const aValue = getSortValue(a, sortConfig.key);
            const bValue = getSortValue(b, sortConfig.key);

            if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1
            if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1
            return 0
        })
        return sorted
    }, [recordsData, sortConfig])

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            order: current.key === key && current.order === 'asc' ? 'desc' : 'asc'
        }))
    }

    // 児童IDから名前へのマップを構築
    const nameByIdMap = useMemo(() => {
        const map = new Map<string, string>();
        recordsData?.children.forEach((child) => {
            if (child.child_id && child.name) {
                map.set(child.child_id, child.name);
            }
        });
        return map;
    }, [recordsData?.children]);

    // メンション付きコンテンツを表示用に変換
    const toDisplayText = useCallback(
        (text: string) => replaceChildIdsWithNames(text, nameByIdMap),
        [nameByIdMap]
    );

    // 履歴取得ハンドラ
    const handleOpenHistory = async (child: Child) => {
        setSelectedChildForHistory(child)
        setHistoryModalOpen(true)
        setHistoryLoading(true)
        setHistoryError(null)

        try {
            const response = await fetch(`/api/records/personal/child/${child.child_id}/recent`)
            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || '履歴の取得に失敗しました')
            }

            setHistoryRecords(result.data?.recent_observations || [])
        } catch (err) {
            console.error('History fetch error:', err)
            setHistoryError(err instanceof Error ? err.message : '履歴の取得に失敗しました')
        } finally {
            setHistoryLoading(false)
        }
    }

    const handleEditRecord = (recordId: string) => {
        router.push(`/records/personal/${recordId}/edit`)
    }

    if (loading) {
        return (
            <StaffLayout title="全児童 月間記録管理">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-slate-600">読み込み中...</p>
                    </div>
                </div>
            </StaffLayout>
        )
    }

    if (error || !recordsData) {
        return (
            <StaffLayout title="全児童 月間記録管理">
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                        <p className="mt-4 text-slate-600">{error || 'データの取得に失敗しました'}</p>
                    </div>
                </div>
            </StaffLayout>
        )
    }

    return (
        <StaffLayout title="記録状況一覧">
            <div className="max-w-[1600px] mx-auto">
                {/* Title */}
                <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <span>ホーム</span>
                        <span className="text-slate-300">/</span>
                        <span>日誌・記録管理</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <FileText className="w-6 h-6 text-indigo-600" />
                        記録状況一覧
                    </h1>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center text-sm font-bold text-slate-700 px-3">
                            <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
                            {year}年 {month}月
                        </div>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-400">
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
                    <div className="relative min-w-[140px]">
                        <select
                            className="w-full appearance-none bg-white border border-slate-300 text-slate-700 py-2 pl-3 pr-8 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="all">全クラス</option>
                            {recordsData.filters.classes.map(cls => (
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

                {/* --- Main Table Section --- */}


                {/* Table Stats */}
                <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
                    <div>
                        表示中: <span className="font-bold text-slate-900">{sortedData.length}</span> 名
                        {warningOnly && <span className="ml-2 text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-xs font-bold">要確認対象</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-indigo-600 rounded-sm"></div> 記録済</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded-sm"></div> 記録なし(在所)</div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-200 rounded-sm"></div> 休み</div>
                    </div>
                </div>

                {/* --- Scrollable Table Wrapper --- */}
                <div className="w-full bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th
                                        scope="col"
                                        className="sticky left-0 z-20 bg-slate-50 px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[180px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        氏名 <SortIcon colKey="name" currentSort={sortConfig} />
                                    </th>

                                    <th
                                        scope="col"
                                        className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
                                        onClick={() => handleSort('grade')}
                                    >
                                        学年・クラス <SortIcon colKey="grade" currentSort={sortConfig} />
                                    </th>

                                    <th
                                        scope="col"
                                        className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[120px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
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

                                    <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider lg:min-w-[350px]">
                                        月間ヒートマップ(1日〜{recordsData.period.days_in_month}日)
                                    </th>

                                    <th
                                        scope="col"
                                        className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[140px] whitespace-nowrap cursor-pointer hover:bg-slate-100"
                                        onClick={() => handleSort('yearly_rate')}
                                    >
                                        年間割合 <SortIcon colKey="yearly_rate" currentSort={sortConfig} />
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

                                            <td className="sticky left-0 z-20 bg-white px-6 py-4 whitespace-nowrap shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900">{child.name}</span>
                                                    <span className="text-xs text-slate-400">{child.kana}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-900">{child.grade_label || '-'}</span>
                                                    <span className="text-xs text-slate-500">{child.class_name}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <LastRecordBadge dateStr={child.last_record_date} />
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap align-middle">
                                                <ProgressBar value={child.monthly.record_count} max={child.monthly.attendance_count} />
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <MonthlyHeatmap history={child.monthly.daily_status} />
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap align-middle">
                                                <ProgressBar value={child.yearly.record_count} max={child.yearly.attendance_count} mini={true} />
                                            </td>

                                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        className="text-slate-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors"
                                                        title="履歴"
                                                        onClick={() => handleOpenHistory(child)}
                                                    >
                                                        <History className="w-4 h-4" />
                                                    </button>
                                                    <Link
                                                        href={`/records/personal/new?childId=${encodeURIComponent(child.child_id)}&childName=${encodeURIComponent(child.name)}`}
                                                        className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all"
                                                    >
                                                        作成
                                                    </Link>
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
                                                    onClick={() => { setSearchTerm(''); setWarningOnly(false); setSelectedClass('all'); }}
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

                {/* 履歴モーダル */}
                <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {selectedChildForHistory?.name}の記録履歴（直近10件）
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 mt-4">
                            {historyLoading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                    <p className="mt-2 text-sm text-slate-500">読み込み中...</p>
                                </div>
                            ) : historyError ? (
                                <div className="text-center py-8 text-red-500">{historyError}</div>
                            ) : historyRecords.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">記録がありません</div>
                            ) : (
                                historyRecords.map((record) => (
                                    <div
                                        key={record.id}
                                        className="border rounded-lg p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                        onClick={() => handleEditRecord(record.id)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-slate-700">
                                                {record.observation_date}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                作成: {new Date(record.created_at).toLocaleString('ja-JP')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 line-clamp-2">
                                            {toDisplayText(record.content)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </StaffLayout>
    )
}
