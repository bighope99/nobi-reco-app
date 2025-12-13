"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function VoiceRecordPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params)
  const router = useRouter()
  const [child, setChild] = useState<any>(null)
  const [voice, setVoice] = useState("")
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
    
    if (!voice.trim()) {
      alert('子どもの声を入力してください')
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/records/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          child_id: childId,
          content: voice.trim(),
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        alert(`✅ ${result.data.child_name}の声記録を保存しました`)
        setVoice('')
      } else {
        alert(`❌ エラー: ${result.error}`)
      }
    } catch (error) {
      console.error('Voice record save error:', error)
      alert('声記録の保存でエラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <StaffLayout title="子どもの声記録">
        <p>読み込み中...</p>
      </StaffLayout>
    )
  }

  if (!child) {
    return (
      <StaffLayout title="子どもの声記録">
        <p>子どもが見つかりません</p>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="子どもの声記録" subtitle={`${child.family_name || ''} ${child.given_name || ''}の声`}>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{child.family_name || ''} {child.given_name || ''}の声</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
