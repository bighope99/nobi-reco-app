import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, ClipboardList, MessageSquare } from "lucide-react"
import Link from "next/link"

const stats = [
  { label: "登録児童数", value: "45", icon: Users, href: "/children" },
  { label: "本日の出席", value: "38", icon: UserCheck, href: "/attendance/list" },
  { label: "本日の記録", value: "12", icon: ClipboardList, href: "/records/status" },
  { label: "子どもの声", value: "5", icon: MessageSquare, href: "/records/status" },
]

const quickLinks = [
  { label: "活動記録を入力", href: "/records/activity" },
  { label: "出席を確認", href: "/attendance/list" },
  { label: "子どもを検索", href: "/children" },
  { label: "クラス設定", href: "/settings/classes" },
]

export default function DashboardPage() {
  return (
    <StaffLayout title="ダッシュボード" subtitle="本日の概要">
      <div className="space-y-6">
        {/* 統計カード */}
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

        {/* クイックリンク */}
        <Card>
          <CardHeader>
            <CardTitle>クイックアクション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-lg border border-border bg-secondary p-4 text-center text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 最近のアクティビティ */}
        <Card>
          <CardHeader>
            <CardTitle>最近の記録</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 border-b border-border pb-4 last:border-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">田中 太郎くん</p>
                    <p className="text-sm text-muted-foreground">
                      積み木で高い塔を作っていました。集中力がついてきています。
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">10分前 - 山本先生</p>
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
