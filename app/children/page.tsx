import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockChildren } from "@/lib/mock-data"
import Link from "next/link"
import { Search, Plus } from "lucide-react"

export default function ChildrenListPage() {
  return (
    <StaffLayout title="子ども一覧" subtitle="登録児童の管理">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="名前で検索..." className="pl-10" />
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/children/new">
                <Plus className="mr-2 h-4 w-4" />
                新規登録
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/children/import">CSV一括登録</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>児童一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockChildren.map((child) => (
                <Link
                  key={child.id}
                  href={`/children/${child.id}`}
                  className="rounded-lg border border-border p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{child.name}</p>
                      <p className="text-sm text-muted-foreground">{child.className}</p>
                    </div>
                    <Badge variant="secondary">{child.age}歳</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
