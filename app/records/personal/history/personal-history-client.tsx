"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useHistoryFilters } from "@/hooks/useHistoryFilters"
import { StaffLayout } from "@/components/layout/staff-layout"
import { HistoryTabs } from "../../_components/history-tabs"
import { Search, ChevronDown, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const GRADES = [
  { value: "", label: "すべて" },
  { value: "1", label: "1年生" },
  { value: "2", label: "2年生" },
  { value: "3", label: "3年生" },
  { value: "4", label: "4年生" },
  { value: "5", label: "5年生" },
  { value: "6", label: "6年生" },
]

interface PersonalItem {
  id: string
  date: string
  childName: string
  className: string | null
  grade: number | null
  gradeLabel: string
  category: string | null
  categoryColor: string | null
  content: string
  objective: string | null
  subjective: string | null
  isAiAnalyzed: boolean
  staffName: string
}

export default function PersonalHistoryClient() {
  const router = useRouter()
  const {
    searchParams,
    fromDate, setFromDate,
    toDate, setToDate,
    selectedClass, setSelectedClass,
    selectedStaff, setSelectedStaff,
    keyword, setKeyword,
    debouncedKeyword,
    classes, staffList,
    childName, setChildName,
    selectedGrade, setSelectedGrade,
  } = useHistoryFilters({ enableChildName: true, enableGrade: true })

  const [items, setItems] = useState<PersonalItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  const latestRequestRef = useRef(0)

  const fetchObservations = useCallback(async (newOffset: number, append: boolean) => {
    const requestId = ++latestRequestRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(newOffset) })
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      if (selectedClass !== 'all') params.set('class_id', selectedClass)
      if (selectedStaff !== 'all') params.set('staff_id', selectedStaff)
      if (childName.trim()) params.set('child_name', childName.trim())
      if (selectedGrade) params.set('grade', selectedGrade)
      if (debouncedKeyword.trim()) params.set('keyword', debouncedKeyword.trim())
      const childId = searchParams.get('childId')
      if (childId) params.set('child_id', childId)

      const res = await fetch(`/api/records/personal?${params}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const newItems: PersonalItem[] = json.data.observations.map((o: {
        id: string
        observation_date: string
        child_name: string
        class_name?: string
        grade?: number
        grade_label?: string
        category?: string
        category_color?: string
        content: string
        objective?: string | null
        subjective?: string | null
        is_ai_analyzed?: boolean
        staff_name?: string
        recorded_by_name?: string | null
      }) => ({
        id: o.id,
        date: o.observation_date,
        childName: o.child_name,
        className: o.class_name || null,
        grade: o.grade ?? null,
        gradeLabel: o.grade_label || '',
        category: o.category || null,
        categoryColor: o.category_color || null,
        content: o.content,
        objective: o.objective ?? null,
        subjective: o.subjective ?? null,
        isAiAnalyzed: o.is_ai_analyzed ?? false,
        staffName: o.recorded_by_name || o.staff_name || '',
      }))

      if (requestId !== latestRequestRef.current) return
      setItems(prev => append ? [...prev, ...newItems] : newItems)
      setTotal(json.data.total)
      setHasMore(json.data.has_more)
      setOffset(newOffset)
    } catch (err) {
      console.error('Failed to fetch observations:', err)
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false)
      }
    }
  }, [fromDate, toDate, selectedClass, selectedStaff, childName, selectedGrade, debouncedKeyword, searchParams])

  useEffect(() => {
    fetchObservations(0, false)
  }, [fetchObservations])

  const handleLoadMore = () => {
    fetchObservations(offset + 20, true)
  }

  return (
    <StaffLayout title="記録履歴">
      <div className="max-w-[1200px] mx-auto pb-12">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>ホーム</span>
            <span className="text-slate-300">/</span>
            <span>日誌・記録管理</span>
            <span className="text-slate-300">/</span>
            <span>記録履歴</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">記録履歴</h1>
        </div>

        <HistoryTabs />

        {/* Filters */}
        {(() => {
          const childId = searchParams.get('childId')
          return (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1.5 min-w-[240px] flex-1">
                  <label className="text-xs font-bold text-slate-500">日付</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                    <span className="text-slate-400">～</span>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>

                {classes.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-[160px]">
                    <label className="text-xs font-bold text-slate-500">クラス</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                      >
                        <option value="all">すべて</option>
                        {classes.map((c) => (
                          <option key={c.class_id} value={c.class_id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {!childId && (
                  <div className="flex flex-col gap-1.5 w-[160px]">
                    <label className="text-xs font-bold text-slate-500">学年</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                      >
                        {GRADES.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 w-[160px]">
                  <label className="text-xs font-bold text-slate-500">記入者</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedStaff}
                      onChange={(e) => setSelectedStaff(e.target.value)}
                    >
                      <option value="all">すべて</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                {!childId && (
                  <div className="flex flex-col gap-1.5 w-[200px]">
                    <label className="text-xs font-bold text-slate-500">児童名</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="児童名で検索"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-slate-500">キーワード</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="記録から検索"
                      maxLength={100}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* List */}
        <div className="flex flex-col gap-4">
          <div className="text-sm text-slate-500 font-medium">
            全 <span className="font-bold text-slate-800">{total}</span> 件中{' '}
            <span className="font-bold text-slate-800">{items.length}</span> 件を表示
          </div>

          {loading && items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-slate-200 rounded-xl bg-white">
              読み込み中...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-slate-200 rounded-xl bg-white">
              条件に一致する記録がありません。
            </div>
          ) : (
            <div className="w-full bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col rounded-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[100px]">記録日</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[180px]">児童名</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[300px]">観察内容</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">記入者</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/records/personal/${item.id}/edit`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">{item.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/records/personal/${item.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
                            aria-label={`${item.childName}の記録を開く`}
                          >
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors text-sm">
                              <User className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                              {item.childName}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 ml-[22px] flex items-center gap-1">
                              {item.className && <span>{item.className}</span>}
                              {item.className && item.gradeLabel && <span>/</span>}
                              {item.gradeLabel && <span>{item.gradeLabel}</span>}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {item.isAiAnalyzed && (item.objective || item.subjective) ? (
                            <div className="space-y-1">
                              {item.objective && (
                                <div>
                                  <span className="text-xs font-bold text-slate-500">事実：</span>
                                  <span className="text-slate-700 text-sm whitespace-pre-wrap line-clamp-5">{item.objective}</span>
                                </div>
                              )}
                              {item.subjective && (
                                <div>
                                  <span className="text-xs font-bold text-slate-500">所感：</span>
                                  <span className="text-slate-700 text-sm whitespace-pre-wrap line-clamp-5">{item.subjective}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-slate-700 text-sm whitespace-pre-wrap line-clamp-5">{item.content}</div>
                          )}
                          {item.category && (
                            <div className="mt-2">
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-bold border border-amber-100">
                                {item.category}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">{item.staffName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {hasMore && (
            <Button
              variant="outline"
              className="mt-4 w-full border-slate-300 text-slate-600 py-6 font-bold hover:bg-slate-50 shadow-sm bg-white"
              onClick={handleLoadMore}
              disabled={loading}
            >
              もっと見る
            </Button>
          )}
        </div>
      </div>
    </StaffLayout>
  )
}
