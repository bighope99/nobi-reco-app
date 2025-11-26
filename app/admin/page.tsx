import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Home, Users, Activity } from "lucide-react"
import Link from "next/link"

const stats = [
  { label: "登録会社数", value: "12", icon: Building2, href: "/admin/companies" },
  { label: "登録施設数", value: "35", icon: Home, href: "/admin/facilities" },
  { label: "総ユーザー数", value: "156", icon: Users, href: "/admin/users" },
  { label: "今月のログイン", value: "1,234", icon: Activity, href: "/admin/logs" },
]

export default function AdminDashboardPage() {
  return (
    <AdminLayout title="サイト管理者ダッシュボード" subtitle="システム全体の概要">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>最近のアクティビティ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 border-b border-border pb-4 last:border-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">新規施設登録</p>
                    <p className="text-sm text-muted-foreground">ひまわり保育園 第{i}分園が登録されました</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{i}時間前</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
