import { Suspense } from "react"
import ActivityRecordClient from "./activity-record-client"

export default function ActivityRecordPage() {
  return (
    <Suspense fallback={null}>
      <ActivityRecordClient />
    </Suspense>
  )
}
