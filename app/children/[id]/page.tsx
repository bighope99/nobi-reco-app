import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mockChildren, mockRecords } from "@/lib/mock-data"
import Link from "next/link"
import { Edit, FileText, BarChart3 } from "lucide-react"

export default async function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const child = mockChildren.find((c) => c.id === id)
  const records = mockRecords.filter((r) => r.childId === id)

  if (!child) {
    return (
      <StaffLayout title="子ども詳細">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="子ども詳細" subtitle={child.name}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{child.name}</CardTitle>
                <p className="text-muted-foreground">{child.className}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/children/${id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    編集
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/children/${id}/summary`}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    成長サマリ
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/children/${id}/report`}>
                    <FileText className="mr-2 h-4 w-4" />
                    レポート生成
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">年齢</p>
                <p className="font-medium">{child.age}歳</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">クラス</p>
                <p className="font-medium">{child.className}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ステータス</p>
                <Badge>{child.status === "present" ? "在籍中" : "欠席"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="observations">
          <TabsList>
            <TabsTrigger value="observations">観察記録</TabsTrigger>
            <TabsTrigger value="voices">子どもの声</TabsTrigger>
            <TabsTrigger value="attendance">出席履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="observations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>観察記録</CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/records/observation/${id}`}>記録を追加</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {records.length > 0 ? (
                  <div className="space-y-4">
                    {records.map((record) => (
                      <div key={record.id} className="border-b border-border pb-4 last:border-0">
                        <p className="text-sm text-muted-foreground">{record.date}</p>
                        <p className="mt-1">{record.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">記録がありません</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="voices">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>子どもの声</CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/records/voice/${id}`}>声を記録</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">子どもの声の記録がありません</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>出席履歴</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">出席履歴を表示します</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </StaffLayout>
  )
}
