"use client"

import { use, useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mockFacilities } from "@/lib/mock-data"

export default function EditFacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const facility = mockFacilities.find((f) => f.id === id)
  const [name, setName] = useState(facility?.name || "")

  if (!facility) {
    return (
      <AdminLayout title="施設編集">
        <p>施設が見つかりません</p>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="施設編集" subtitle={facility.name}>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>施設情報の編集</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">施設名</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">住所</Label>
                <Input id="address" defaultValue="東京都〇〇区..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" type="tel" defaultValue="03-1234-5678" />
              </div>
              <div className="flex gap-2">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline">
                  キャンセル
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
