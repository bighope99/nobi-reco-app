"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function NewCompanyPage() {
  const [name, setName] = useState("")

  return (
    <AdminLayout title="会社登録" subtitle="新しい会社を登録">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>会社情報</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">会社名</Label>
                <Input
                  id="name"
                  placeholder="例: 株式会社〇〇"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">住所</Label>
                <Textarea id="address" placeholder="住所を入力" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" type="tel" placeholder="03-1234-5678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input id="email" type="email" placeholder="info@example.com" />
              </div>
              <div className="flex gap-2">
                <Button type="submit">登録</Button>
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
