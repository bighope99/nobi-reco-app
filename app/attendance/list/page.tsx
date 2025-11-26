import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { mockChildren } from "@/lib/mock-data"

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  present: { label: "出席", variant: "default" },
  absent: { label: "欠席", variant: "secondary" },
  late: { label: "遅刻", variant: "destructive" },
}

export default function AttendanceListPage() {
  const presentCount = mockChildren.filter((c) => c.status === "present").length
  const absentCount = mockChildren.filter((c) => c.status === "absent").length

  return (
    <StaffLayout title="出席児童一覧" subtitle="本日の出席状況">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">出席</p>
              <p className="text-3xl font-bold text-primary">{presentCount}名</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">欠席</p>
              <p className="text-3xl font-bold">{absentCount}名</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">合計</p>
              <p className="text-3xl font-bold">{mockChildren.length}名</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>児童一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockChildren.map((child) => (
                <div key={child.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{child.name}</p>
                    <p className="text-sm text-muted-foreground">{child.className}</p>
                  </div>
                  <Badge variant={statusLabels[child.status].variant}>{statusLabels[child.status].label}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
