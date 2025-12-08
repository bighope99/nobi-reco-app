import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockStaff } from "@/lib/mock-data"
import { Plus, Edit } from "lucide-react"

const roleLabels: Record<string, string> = {
  admin: "管理者",
  staff: "職員",
}

export default function UserSettingsPage() {
  return (
    <StaffLayout title="職員管理" subtitle="職員アカウントと権限の管理">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            職員を追加
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>職員一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockStaff.map((staff) => (
                <div key={staff.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium">{staff.name}</p>
                    <p className="text-sm text-muted-foreground">{staff.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={staff.role === "admin" ? "default" : "secondary"}>{roleLabels[staff.role]}</Badge>
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
