"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/useDebounce"
import { StaffLayout } from "@/components/layout/staff-layout"
import { HistoryTabs } from "../../_components/history-tabs"
import { Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ActivityItem {
  id: string
  date: string
  className: string
  title: string
  content: string
  staffName: string
  personalRecordCount: number
}

interface ClassOption {
  class_id: string
  name: string
}

export default function ActivityHistoryClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [fromDate, setFromDate] = useState(() => searchParams.get("from_date") ?? "")
  const [toDate, setToDate] = useState(() => searchParams.get("to_date") ?? "")
  const [selectedClass, setSelectedClass] = useState(() => searchParams.get("class_id") ?? "all")
  const [selectedStaff, setSelectedStaff] = useState("all")
  const [keyword, setKeyword] = useState("")
  const debouncedKeyword = useDebounce(keyword, 500)

  const [items, setItems] = useState<ActivityItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  const [classes, setClasses] = useState<ClassOption[]>([])
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const nextFromDate = searchParams.get("from_date") ?? ""
    const nextToDate = searchParams.get("to_date") ?? ""
    const nextClassId = searchParams.get("class_id") ?? "all"

    setFromDate((current) => (current === nextFromDate ? current : nextFromDate))
    setToDate((current) => (current === nextToDate ? current : nextToDate))
    setSelectedClass((current) => (current === nextClassId ? current : nextClassId))
  }, [searchParams])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (fromDate) {
      params.set("from_date", fromDate)
    } else {
      params.delete("from_date")
    }

    if (toDate) {
      params.set("to_date", toDate)
    } else {
      params.delete("to_date")
    }

    if (selectedClass !== "all") {
      params.set("class_id", selectedClass)
    } else {
      params.delete("class_id")
    }

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }, [fromDate, toDate, selectedClass, pathname, router, searchParams])

  useEffect(() => {
    const fetchMeta = async () => {
      const classRes = await fetch('/api/classes')
      const classJson = await classRes.json()
      if (classJson.success) setClasses(classJson.data?.classes || [])

      const staffRes = await fetch('/api/users?is_active=true')
      if (staffRes.ok) {
        const staffJson = await staffRes.json()
        if (staffJson.success) setStaffList(
          (staffJson.data?.users || []).map((u: { user_id: string; name: string }) => ({ id: u.user_id, name: u.name }))
        )
      }
    }
    fetchMeta()
  }, [])

  const fetchActivities = useCallback(async (newOffset: number, append: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(newOffset) })
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      if (selectedClass !== 'all') params.set('class_id', selectedClass)
      if (selectedStaff !== 'all') params.set('staff_id', selectedStaff)
      if (debouncedKeyword.trim()) params.set('keyword', debouncedKeyword.trim())

      const res = await fetch(`/api/activities?${params}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      const newItems: ActivityItem[] = json.data.activities.map((a: {
        activity_id: string
        activity_date: string
        class_name?: string
        title: string
        content: string
        created_by?: string
        recorded_by_name?: string | null
        individual_record_count?: number
      }) => ({
        id: a.activity_id,
        date: a.activity_date,
        className: a.class_name || '',
        title: a.title,
        content: a.content,
        staffName: a.recorded_by_name || a.created_by || '',
        personalRecordCount: a.individual_record_count || 0,
      }))

      setItems(prev => append ? [...prev, ...newItems] : newItems)
      setTotal(json.data.total)
      setHasMore(json.data.has_more)
      setOffset(newOffset)
    } catch (err) {
      console.error('Failed to fetch activities:', err)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, selectedClass, selectedStaff, debouncedKeyword])

  useEffect(() => {
    fetchActivities(0, false)
  }, [fetchActivities])

  const handleLoadMore = () => {
    fetchActivities(offset + 20, true)
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:flex-none">
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
            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:flex-none">
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

          <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:flex-none">
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

          <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:max-w-xs">
            <label className="text-xs font-bold text-slate-500">キーワード</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="内容から検索"
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
        </div>

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
                      {classes.length > 0 && <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">クラス</th>}
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[300px]">活動内容</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">記入者</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => router.push(`/records/activity?activityId=${item.id}`)}>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">{item.date}</td>
                        {classes.length > 0 && <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{item.className}</td>}
                        <td className="px-6 py-4 text-sm">
                          <div className="text-slate-700 line-clamp-3">{item.content}</div>
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
              {loading ? '読み込み中...' : 'もっと見る'}
            </Button>
          )}
        </div>
      </div>
    </StaffLayout>
  )
}
