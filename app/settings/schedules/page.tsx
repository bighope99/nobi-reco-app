import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function ScheduleSettingsPage() {
  return (
    <StaffLayout title="通所設定" subtitle="子ども別の通所曜日を設定">
      <Card>
        <CardHeader>
          <CardTitle>通所設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            各児童の通所曜日は{" "}
            <Link href="/attendance/schedule" className="text-primary underline">
              出席予定登録
            </Link>{" "}
            から設定できます。
          </p>
        </CardContent>
      </Card>
    </StaffLayout>
  )
}
