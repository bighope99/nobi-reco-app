import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

const mockLogs = [
  { id: "1", user: "山本先生", action: "ログイン", timestamp: "2024-01-15 09:00:00", status: "success" },
  { id: "2", user: "中村先生", action: "ログイン", timestamp: "2024-01-15 09:15:00", status: "success" },
  { id: "3", user: "小林先生", action: "ログイン失敗", timestamp: "2024-01-15 09:20:00", status: "error" },
  { id: "4", user: "山本先生", action: "記録追加", timestamp: "2024-01-15 10:00:00", status: "success" },
  { id: "5", user: "中村先生", action: "児童情報更新", timestamp: "2024-01-15 10:30:00", status: "success" },
]

export default function SystemLogsPage() {
  return (
    <AdminLayout title="システムログ" subtitle="ログイン履歴・操作ログ">
      <div className="space-y-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ユーザー名で検索..." className="pl-10" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ログ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{log.user}</p>
                      <p className="text-sm text-muted-foreground">{log.action}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>
                      {log.status === "success" ? "成功" : "エラー"}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{log.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
