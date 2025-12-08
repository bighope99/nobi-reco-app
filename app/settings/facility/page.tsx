"use client"

import { useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function FacilitySettingsPage() {
  const [name, setName] = useState("ひまわり保育園 本園")
  const [address, setAddress] = useState("東京都渋谷区〇〇町1-2-3")

  return (
    <StaffLayout title="施設情報管理" subtitle="施設の基本情報を設定">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>施設情報</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">施設名</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">住所</Label>
                <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" type="tel" defaultValue="03-1234-5678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input id="email" type="email" defaultValue="info@himawari.example.com" />
              </div>
              <Button type="submit">保存</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
