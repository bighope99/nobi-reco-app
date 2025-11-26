import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { mockChildren } from "@/lib/mock-data"
import { Download, Printer } from "lucide-react"

export default async function ChildReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const child = mockChildren.find((c) => c.id === id)

  if (!child) {
    return (
      <StaffLayout title="レポート生成">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="レポート生成" subtitle={`${child.name}の成長レポート`}>
      <div className="space-y-6">
        <div className="flex gap-2">
          <Button>
            <Download className="mr-2 h-4 w-4" />
            PDFダウンロード
          </Button>
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            印刷
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>成長レポートプレビュー</CardTitle>
          </CardHeader>
          <CardContent className="bg-muted/50 p-8">
            <div className="mx-auto max-w-2xl space-y-6 rounded-lg bg-card p-8 shadow">
              <div className="text-center">
                <h2 className="text-2xl font-bold">成長レポート</h2>
                <p className="text-muted-foreground">{child.name}</p>
                <p className="text-sm text-muted-foreground">2024年1月</p>
              </div>
              <div>
                <h3 className="mb-2 font-bold">基本情報</h3>
                <p>クラス: {child.className}</p>
                <p>年齢: {child.age}歳</p>
              </div>
              <div>
                <h3 className="mb-2 font-bold">今月の様子</h3>
                <p className="text-muted-foreground">
                  積み木遊びに夢中になり、集中力が向上しています。 お友達と協力して遊ぶ姿も見られるようになりました。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
