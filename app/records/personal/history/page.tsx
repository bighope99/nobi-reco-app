import { Suspense } from "react"
import PersonalHistoryClient from "./personal-history-client"

export default function PersonalHistoryPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">読み込み中...</div>}>
      <PersonalHistoryClient />
    </Suspense>
  )
}
