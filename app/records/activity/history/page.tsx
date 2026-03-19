import { Suspense } from "react"
import ActivityHistoryClient from "./activity-history-client"

export default function ActivityHistoryPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">読み込み中...</div>}>
      <ActivityHistoryClient />
    </Suspense>
  )
}
