import { Suspense } from "react"
import ActivityRecordClient from "./activity-record-client"

export default function ActivityRecordPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">読み込み中...</div>}>
      <ActivityRecordClient />
    </Suspense>
  )
}
