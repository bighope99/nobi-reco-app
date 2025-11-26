"use client"

import { useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function ActivityRecordPage() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  return (
    <StaffLayout title="活動記録入力" subtitle="今日の全体活動を記録">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>今日の活動</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">日付</Label>
                <Input id="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">活動タイトル</Label>
                <Input
                  id="title"
                  placeholder="例: 外遊び、製作活動など"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">活動内容</Label>
                <Textarea
                  id="content"
                  placeholder="今日の活動内容を記入してください..."
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline">
                  下書き保存
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
