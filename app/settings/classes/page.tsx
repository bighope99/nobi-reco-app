"use client"

import { useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { mockClasses } from "@/lib/mock-data"
import { Plus, Edit, Trash2 } from "lucide-react"

export default function ClassSettingsPage() {
  const [classes, setClasses] = useState(mockClasses)
  const [newClassName, setNewClassName] = useState("")

  const addClass = () => {
    if (newClassName.trim()) {
      setClasses([...classes, { id: String(classes.length + 1), name: newClassName, childrenCount: 0 }])
      setNewClassName("")
    }
  }

  return (
    <StaffLayout title="クラス管理" subtitle="クラスの登録・編集">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>新規クラス追加</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="クラス名を入力"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              />
              <Button onClick={addClass}>
                <Plus className="mr-2 h-4 w-4" />
                追加
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>クラス一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{cls.name}</p>
                    <p className="text-sm text-muted-foreground">{cls.childrenCount}名</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
