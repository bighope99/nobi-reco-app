"use client"

import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Database } from "lucide-react"

export default function DataExportPage() {
  return (
    <StaffLayout title="データ管理" subtitle="データのエクスポート・バックアップ">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">児童データ</CardTitle>
                  <p className="text-sm text-muted-foreground">全児童の基本情報をCSVでエクスポート</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/children/export" download>
                  <Download className="mr-2 h-4 w-4" />
                  エクスポート
                </a>
              </Button>
            </div>
          </CardHeader>
        </Card>
        {/* 記録データ・出席データ・バックアップは未実装 */}
        {[
          { label: "記録データ", description: "観察記録・子どもの声をエクスポート" },
          { label: "出席データ", description: "出席履歴をエクスポート" },
          { label: "全データバックアップ", description: "全てのデータをバックアップ" },
        ].map((option) => (
          <Card key={option.label}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{option.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  <Download className="mr-2 h-4 w-4" />
                  エクスポート
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </StaffLayout>
  )
}
