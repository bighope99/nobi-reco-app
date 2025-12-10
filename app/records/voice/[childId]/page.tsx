"use client"

import { use, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { mockChildren } from "@/lib/mock-data"

export default function VoiceRecordPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params)
  const child = mockChildren.find((c) => c.id === childId)
  const [voice, setVoice] = useState("")

  if (!child) {
    return (
      <StaffLayout title="子どもの声記録">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="子どもの声記録" subtitle={`${child.name}の声`}>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{child.name}の声</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voice">子どもの言葉・発言</Label>
                <Textarea
                  id="voice"
                  placeholder="子どもの印象的な言葉を記録してください..."
                  rows={4}
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">例: 「明日もこれ作りたい！」「〇〇くんと遊ぶの楽しい」</p>
              </div>
              <Button type="submit">保存</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
