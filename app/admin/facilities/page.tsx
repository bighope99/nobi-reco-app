import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mockFacilities } from "@/lib/mock-data"
import Link from "next/link"
import { Search, Plus, Edit } from "lucide-react"

export default function FacilitiesPage() {
  return (
    <AdminLayout title="施設一覧" subtitle="全施設の管理">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="施設名で検索..." className="pl-10" />
          </div>
          <Button asChild>
            <Link href="/admin/facilities/new">
              <Plus className="mr-2 h-4 w-4" />
              施設を追加
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>施設一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div>
                    <p className="font-medium">{facility.name}</p>
                    <p className="text-sm text-muted-foreground">児童数: {facility.childrenCount}</p>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/facilities/${facility.id}/edit`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
