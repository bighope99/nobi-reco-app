"use client"

import { use, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockChildren } from "@/lib/mock-data"
import Link from "next/link"

const observationCategories = [
  "社会性・コミュニケーション",
  "身体・運動",
  "言語・表現",
  "認知・思考",
  "生活習慣",
  "その他",
]

export default function ObservationPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params)
  const child = mockChildren.find((c) => c.id === childId)
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("")

  if (!child) {
    return (
      <StaffLayout title="子ども観察記録">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="子ども観察記録" subtitle={`${child.name}の記録`}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{child.name}</span>
              <span className="text-sm font-normal text-muted-foreground">{child.className}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">観察カテゴリ</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="カテゴリを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {observationCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">観察内容</Label>
                <Textarea
                  id="content"
                  placeholder="今日の様子を記入してください..."
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={`/records/voice/${childId}`}>子どもの声を記録</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>過去の記録</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-b border-border pb-4">
                <p className="text-sm text-muted-foreground">2024/01/14 - 社会性</p>
                <p className="mt-1">お友達と協力して絵を描いていました。</p>
              </div>
              <div className="border-b border-border pb-4">
                <p className="text-sm text-muted-foreground">2024/01/13 - 身体・運動</p>
                <p className="mt-1">縄跳びで10回連続で跳べるようになりました。</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
