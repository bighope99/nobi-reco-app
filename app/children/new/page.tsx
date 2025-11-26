"use client"

import { useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockClasses } from "@/lib/mock-data"

export default function ChildNewPage() {
  const [name, setName] = useState("")
  const [className, setClassName] = useState("")

  return (
    <StaffLayout title="子ども新規登録" subtitle="新しい児童を登録">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">名前</Label>
                <Input id="name" placeholder="例: 山田 太郎" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">クラス</Label>
                <Select value={className} onValueChange={setClassName}>
                  <SelectTrigger>
                    <SelectValue placeholder="クラスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">生年月日</Label>
                <Input id="birthdate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guardian">保護者名</Label>
                <Input id="guardian" placeholder="例: 山田 花子" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">連絡先</Label>
                <Input id="phone" type="tel" placeholder="090-1234-5678" />
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
    </StaffLayout>
  )
}
