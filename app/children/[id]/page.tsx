"use client"

import { useState, useEffect, useCallback, use } from 'react'
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Edit, BarChart3 } from "lucide-react"
import { AddGuardianModal } from '@/components/children/AddGuardianModal'

interface GuardianInfo {
  guardian_id: string
  name: string | null
  kana: string | null
  phone: string | null
  relationship: string | null
  is_primary: boolean
  is_emergency_contact: boolean
  photo_url: string | null
}

interface ChildSummary {
  child_info: {
    child_id: string
    name: string
    kana: string
    age: number
    birth_date: string
    class_name: string
    photo_url: string | null
  }
  period: {
    start_date: string
    end_date: string
    days: number
    display_label: string
  }
  categories: Array<{
    category_id: string
    name: string
    description: string
    score: number
    level: string
    trend: string
    observation_count: number
    icon: string
  }>
  overall: {
    total_score: number
    level: string
    total_observations: number
    total_activities: number
    attendance_rate: number
  }
  recent_observations: Array<{
    observation_id: string
    date: string
    content: string
  }>
  generated_at: string
}

export default function ChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [summary, setSummary] = useState<ChildSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardians, setGuardians] = useState<GuardianInfo[]>([])
  const [guardianLoading, setGuardianLoading] = useState(true)
  const [showAddGuardian, setShowAddGuardian] = useState(false)
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null)

  const fetchGuardians = useCallback(async () => {
    try {
      setGuardianLoading(true)
      const res = await fetch(`/api/children/${id}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setGuardians(data.data.guardians ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch guardians:', err)
    } finally {
      setGuardianLoading(false)
    }
  }, [id])

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/children/${id}/summary`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch summary')
        }

        if (result.success) {
          setSummary(result.data)
        }
      } catch (err) {
        console.error('Failed to fetch summary:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch summary')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
    fetchGuardians()
  }, [id, fetchGuardians])

  const getLevelColor = (level: string) => {
    switch (level) {
      case '優秀':
        return 'text-green-600'
      case '良好':
        return 'text-blue-600'
      case '標準':
        return 'text-slate-600'
      default:
        return 'text-slate-600'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-green-500'
    if (score >= 75) return 'bg-blue-500'
    return 'bg-slate-400'
  }

  if (loading) {
    return (
      <StaffLayout title="児童詳細">
        <div className="p-12 text-center text-slate-400">
          <p>読み込み中...</p>
        </div>
      </StaffLayout>
    )
  }

  if (error || !summary) {
    return (
      <StaffLayout title="児童詳細">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">エラー: {error || '児童情報が見つかりません'}</p>
        </div>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="児童詳細" subtitle={`${summary.child_info.name} • ${summary.child_info.class_name}`}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{summary.child_info.name}</CardTitle>
                <p className="text-muted-foreground">{summary.child_info.kana}</p>
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">年齢</p>
                <p className="font-medium">{summary.child_info.age}歳</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">クラス</p>
                <p className="font-medium">{summary.child_info.class_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">総合評価</p>
                <p className={`font-medium ${getLevelColor(summary.overall.level)}`}>
                  {summary.overall.level} ({summary.overall.total_score})
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">出席率</p>
                <p className="font-medium">{summary.overall.attendance_rate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>観点別評価 ({summary.period.display_label})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.categories.map((category) => (
                <div key={category.category_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{category.icon}</span>
                      <p className="font-medium text-sm">{category.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{category.level}</Badge>
                      <span className="text-sm font-medium w-12 text-right">{category.score}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getScoreColor(category.score)} transition-all`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近の観察記録</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recent_observations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                観察記録がありません
              </p>
            ) : (
              <div className="space-y-3">
                {summary.recent_observations.map((obs) => (
                  <div
                    key={obs.observation_id}
                    className="rounded-lg border border-border p-3 hover:bg-slate-50"
                  >
                    <p className="text-sm text-muted-foreground mb-1">{obs.date}</p>
                    <p className="text-sm">{obs.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 保護者情報 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>保護者情報</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddGuardian(true)}>
                + 保護者を追加
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {guardianLoading ? (
              <p className="text-center text-muted-foreground py-4">読み込み中...</p>
            ) : guardians.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">保護者が登録されていません</p>
            ) : (
              <div className="space-y-3">
                {guardians.map((g) => (
                  <div key={g.guardian_id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    {/* 写真 */}
                    <div
                      className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                      onClick={() => g.photo_url && setZoomPhotoUrl(g.photo_url)}
                    >
                      {g.photo_url ? (
                        <img src={g.photo_url} alt={g.name ?? ''} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400 text-xs">写真なし</span>
                      )}
                    </div>
                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{g.name ?? '氏名未設定'}</span>
                        {g.relationship && (
                          <Badge variant="outline" className="text-xs">{g.relationship}</Badge>
                        )}
                        {g.is_primary && (
                          <Badge className="text-xs bg-indigo-100 text-indigo-700">主連絡先</Badge>
                        )}
                      </div>
                      {g.kana && <p className="text-xs text-muted-foreground mt-0.5">{g.kana}</p>}
                      {g.phone && <p className="text-sm text-muted-foreground mt-0.5">{g.phone}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 写真ズームモーダル */}
      {zoomPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <img
            src={zoomPhotoUrl}
            alt="保護者写真"
            className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* 保護者追加モーダル */}
      <AddGuardianModal
        childId={id}
        open={showAddGuardian}
        onClose={() => setShowAddGuardian(false)}
        onSuccess={() => { setShowAddGuardian(false); fetchGuardians() }}
      />
    </StaffLayout>
  )
}
