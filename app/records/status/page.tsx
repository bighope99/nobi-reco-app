import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { mockChildren, mockClasses } from "@/lib/mock-data"
import Link from "next/link"

export default function RecordStatusPage() {
  return (
    <StaffLayout title="記録状況一覧" subtitle="本日の入力状況">
      <div className="space-y-6">
        {mockClasses.map((cls) => (
          <Card key={cls.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {cls.name}
                <Badge variant="secondary">{cls.childrenCount}名</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mockChildren
                  .filter((child) => child.className === cls.name)
                  .map((child) => (
                    <Link
                      key={child.id}
                      href={`/records/observation/${child.id}`}
                      className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                    >
                      <span className="font-medium">{child.name}</span>
                      <Badge variant={child.status === "present" ? "default" : "secondary"}>
                        {child.status === "present" ? "記録あり" : "未記録"}
                      </Badge>
                    </Link>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </StaffLayout>
  )
}
