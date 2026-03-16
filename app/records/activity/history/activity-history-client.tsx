"use client"

import { useState, useMemo } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { HistoryTabs } from "../../_components/history-tabs"
import { mockActivityHistory, mockClasses, mockStaff } from "@/lib/mock-data"
import { Search, Calendar, ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const ITEMS_PER_PAGE = 20

export default function ActivityHistoryClient() {
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedStaff, setSelectedStaff] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)

  const filteredHistory = useMemo(() => {
    return mockActivityHistory.filter((item) => {
      // Date filter
      if (fromDate && item.date < fromDate) return false
      if (toDate && item.date > toDate) return false

      // Class filter
      if (selectedClass !== "all" && item.className !== selectedClass) return false

      // Staff filter
      if (selectedStaff !== "all" && item.staffName !== selectedStaff) return false

      // Keyword filter
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase()
        const matchesTitle = item.title.toLowerCase().includes(lowerKeyword)
        const matchesContent = item.content.toLowerCase().includes(lowerKeyword)
        if (!matchesTitle && !matchesContent) return false
      }

      return true
    })
  }, [fromDate, toDate, selectedClass, selectedStaff, keyword])

  const displayedItems = filteredHistory.slice(0, displayCount)
  const hasMore = displayCount < filteredHistory.length

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + ITEMS_PER_PAGE)
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

          <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:flex-none">
            <label className="text-xs font-bold text-slate-500">クラス</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="all">すべて</option>
                {mockClasses.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:flex-none">
            <label className="text-xs font-bold text-slate-500">記入者</label>
            <div className="relative">
              <select
                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
              >
                <option value="all">すべて</option>
                {mockStaff.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
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
            全 <span className="font-bold text-slate-800">{filteredHistory.length}</span> 件中 <span className="font-bold text-slate-800">{displayedItems.length}</span> 件を表示
          </div>
          
          {displayedItems.length === 0 ? (
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
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">クラス</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[300px]">活動内容</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">記入者</th>
                      {false && <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[100px]">個別記録</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {displayedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">{item.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {item.className}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="text-slate-700 line-clamp-3">{item.content}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">{item.staffName}</td>
                        {false && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            {item.personalRecordCount > 0 ? (
                              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold text-xs">{item.personalRecordCount} 件</span>
                            ) : (
                              <span className="text-slate-400 bg-slate-50 px-3 py-1 rounded-full text-xs font-medium">--</span>
                            )}
                          </td>
                        )}
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
            >
              もっと見る
            </Button>
          )}
        </div>
      </div>
    </StaffLayout>
  )
}
