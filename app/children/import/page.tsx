import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Download } from "lucide-react"

export default function ChildImportPage() {
  return (
    <StaffLayout title="CSV一括登録" subtitle="CSVファイルから児童を一括登録">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>CSVファイルのアップロード</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">CSVファイルをドラッグ＆ドロップ</p>
              <p className="text-xs text-muted-foreground">または</p>
              <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                ファイルを選択
              </Button>
            </div>
            <Button className="w-full">アップロード</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSVテンプレート</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              CSVファイルの形式がわからない場合は、テンプレートをダウンロードしてください。
            </p>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              テンプレートをダウンロード
            </Button>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
