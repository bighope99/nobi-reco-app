"use client"

import { useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Database } from "lucide-react"

const exportOptions = [
  { type: "children", label: "児童データ", description: "全児童の基本情報をCSVでエクスポート" },
  { type: "records", label: "記録データ", description: "観察記録・子どもの声をエクスポート" },
  { type: "attendance", label: "出席データ", description: "出席履歴をエクスポート" },
  { type: "backup", label: "全データバックアップ", description: "全てのデータをバックアップ" },
]

export default function DataExportPage() {
  const [loadingType, setLoadingType] = useState<string | null>(null)

  const handleExport = async (type: string) => {
    setLoadingType(type)
    
    try {
      const response = await fetch('/api/data/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`エラー: ${error.error}`)
        return
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `export_${type}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('✅ エクスポートが完了しました')
    } catch (error) {
      console.error('Export error:', error)
      alert('エクスポート中にエラーが発生しました')
    } finally {
      setLoadingType(null)
    }
  }

  return (
    <StaffLayout title="データ管理" subtitle="データのエクスポート・バックアップ">
      <div className="mx-auto max-w-2xl space-y-4">
        {exportOptions.map((option) => (
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExport(option.type)}
                  disabled={loadingType === option.type}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {loadingType === option.type ? 'エクスポート中...' : 'エクスポート'}
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </StaffLayout>
  )
}
