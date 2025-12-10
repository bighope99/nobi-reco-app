"use client"

import { useState, useEffect } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Activity {
  activity_id: string
  activity_date: string
  title: string
  content: string
  snack: string | null
  photos: any[]
  class_name: string
  created_by: string
  created_at: string
  is_draft: boolean
  status: string
  individual_record_count: number
}

interface ActivitiesData {
  activities: Activity[]
  total: number
  has_more: boolean
}

export default function ActivityRecordPage() {
  const [activitiesData, setActivitiesData] = useState<ActivitiesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/activities?limit=10')
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch activities')
        }

        if (result.success) {
          setActivitiesData(result.data)
        }
      } catch (err) {
        console.error('Failed to fetch activities:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch activities')
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <StaffLayout title="活動記録" subtitle="クラスの活動記録一覧">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">エラー: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <p>読み込み中...</p>
          </div>
        ) : activitiesData && (
          <Card>
            <CardHeader>
              <CardTitle>活動記録一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesData.activities.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p>活動記録が見つかりませんでした</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activitiesData.activities.map((activity) => (
                    <div
                      key={activity.activity_id}
                      className="flex items-start justify-between rounded-lg border border-border p-4 hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(activity.activity_date)}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {activity.class_name}
                          </span>
                          {activity.is_draft && (
                            <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                              下書き
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{activity.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {activity.content}
                        </p>
                        {activity.snack && (
                          <p className="text-sm text-muted-foreground">
                            おやつ: {activity.snack}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>記録者: {activity.created_by}</span>
                          {activity.individual_record_count > 0 && (
                            <span>個別記録: {activity.individual_record_count}件</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </StaffLayout>
  )
}
