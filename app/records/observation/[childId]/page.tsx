"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  const router = useRouter()
  const [child, setChild] = useState<any>(null)
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchChild = async () => {
      try {
        const response = await fetch(`/api/children/${childId}`)
        const result = await response.json()
        
        if (result.success) {
          setChild(result.data)
        } else {
          alert(`エラー: ${result.error}`)
        }
      } catch (error) {
        console.error('Child fetch error:', error)
        alert('子ども情報の取得でエラーが発生しました')
      } finally {
        setIsLoading(false)
      }
    }

    fetchChild()
  }, [childId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!category) {
      alert('観察カテゴリを選択してください')
      return
    }
    
    if (!content.trim()) {
      alert('観察内容を入力してください')
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/records/observation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          child_id: childId,
          content: content.trim(),
          category,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`✅ ${result.data.child_name}の観察記録を保存しました`)
        setContent('')
        setCategory('')
        // Optionally navigate back or reset form
      } else {
        alert(`❌ エラー: ${result.error}`)
      }
    } catch (error) {
      console.error('Observation record save error:', error)
      alert('観察記録の保存でエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <StaffLayout title="子ども観察記録">
        <p>読み込み中...</p>
      </StaffLayout>
    )
  }

  if (!child) {
    return (
      <StaffLayout title="子ども観察記録">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="子ども観察記録" subtitle={`${child.family_name || ''} ${child.given_name || ''}の記録`}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{child.family_name || ''} {child.given_name || ''}</span>
              <span className="text-sm font-normal text-muted-foreground">{child.class_name || 'クラス未設定'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
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
