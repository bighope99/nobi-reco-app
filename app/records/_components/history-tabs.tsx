"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

export function HistoryTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabs = [
    { name: "活動記録", href: "/records/activity/history" },
    { name: "個別記録", href: "/records/personal/history" },
  ]

  const buildHref = (baseHref: string) => {
    if (!searchParams) return baseHref

    // 共通の検索条件を引き継ぐ
    const params = new URLSearchParams(searchParams.toString())
    const from = params.get("from")
    const to = params.get("to")
    const classId = params.get("classId") // class_id もしくは classId

    const newParams = new URLSearchParams()
    if (from) newParams.set("from", from)
    if (to) newParams.set("to", to)
    if (classId) newParams.set("classId", classId)

    const queryString = newParams.toString()
    return queryString ? `${baseHref}?${queryString}` : baseHref
  }

  return (
    <div className="border-b border-slate-200 mb-6">
      <nav className="-mb-px flex gap-6 px-4 md:px-0" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.name}
              href={buildHref(tab.href)}
              className={cn(
                "whitespace-nowrap py-4 px-2 border-b-2 font-bold text-sm transition-all",
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {tab.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
