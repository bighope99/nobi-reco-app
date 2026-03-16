"use client"

import { useState, useMemo } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { HistoryTabs } from "../../_components/history-tabs"
import { mockPersonalHistory, mockClasses, mockStaff } from "@/lib/mock-data"
import { Search, Calendar, ChevronDown, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const ITEMS_PER_PAGE = 20
const GRADES = ["すべて", "0歳児", "1歳児", "2歳児", "3歳児", "4歳児", "5歳児"]

export default function PersonalHistoryClient() {
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selectedClass, setSelectedClass] = useState("all")
  const [selectedStaff, setSelectedStaff] = useState("all")
  const [childName, setChildName] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("すべて")
  const [keyword, setKeyword] = useState("")
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)

  const filteredHistory = useMemo(() => {
    return mockPersonalHistory.filter((item) => {
      // Date filter
      if (fromDate && item.date < fromDate) return false
      if (toDate && item.date > toDate) return false

      // Class filter
      if (selectedClass !== "all" && item.className !== selectedClass) return false

      // Staff filter
      if (selectedStaff !== "all" && item.staffName !== selectedStaff) return false

      // Grade filter
      if (selectedGrade !== "すべて" && item.grade !== selectedGrade) return false

      // Child Name filter (partial match)
      if (childName) {
        const lowerName = childName.toLowerCase()
        if (!item.childName.toLowerCase().includes(lowerName)) return false
      }

      // Keyword filter
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase()
        if (!item.content.toLowerCase().includes(lowerKeyword)) return false
      }

      return true
    })
  }, [fromDate, toDate, selectedClass, selectedStaff, childName, selectedGrade, keyword])

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
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:max-w-[300px]">
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

            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:max-w-[160px]">
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

            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:max-w-[160px]">
              <label className="text-xs font-bold text-slate-500">学年</label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:max-w-[160px]">
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
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1 md:max-w-[200px]">
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

            <div className="w-full md:w-auto flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-bold text-slate-500">キーワード</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="記録から検索"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
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
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[180px]">児童名</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[300px]">観察内容</th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[120px]">記入者</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {displayedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">{item.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5 group-hover:text-indigo-600 transition-colors text-sm">
                            <User className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                            {item.childName}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 ml-[22px] flex items-center gap-1">
                            <span>{item.className}</span>
                            <span>/</span>
                            <span>{item.grade}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700 text-sm whitespace-pre-wrap">{item.content}</div>
                          <div className="mt-2">
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-bold border border-amber-100">
                              {item.category}
                            </span>
                          </div>
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
            >
              もっと見る
            </Button>
          )}
        </div>
      </div>
    </StaffLayout>
  )
}
