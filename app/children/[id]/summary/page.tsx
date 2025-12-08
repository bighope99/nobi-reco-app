import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { mockChildren } from "@/lib/mock-data"

const categories = [
  { name: "社会性・コミュニケーション", score: 75 },
  { name: "身体・運動", score: 85 },
  { name: "言語・表現", score: 70 },
  { name: "認知・思考", score: 80 },
  { name: "生活習慣", score: 90 },
]

export default async function ChildSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const child = mockChildren.find((c) => c.id === id)

  if (!child) {
    return (
      <StaffLayout title="成長サマリ">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="成長サマリ" subtitle={`${child.name}の成長記録`}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>観点別評価グラフ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{cat.name}</span>
                    <span className="text-muted-foreground">{cat.score}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${cat.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>強み</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                <li>生活習慣がしっかり身についている</li>
                <li>運動能力が高く、積極的に体を動かす</li>
                <li>集中力が向上している</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>のびしろ</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                <li>お友達との関わりを増やす</li>
                <li>言葉で気持ちを伝える練習</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffLayout>
  )
}
