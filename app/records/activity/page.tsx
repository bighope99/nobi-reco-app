"use client"

import { useState, useEffect } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Mic, Sparkles, Camera, X } from "lucide-react"

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
  const [classOptions, setClassOptions] = useState<Array<{ class_id: string; class_name: string }>>([])
  const [classError, setClassError] = useState<string | null>(null)
  const [isLoadingClasses, setIsLoadingClasses] = useState(true)

  // 記録入力フォームの状態
  const [selectedClass, setSelectedClass] = useState("")
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0])
  const [activityContent, setActivityContent] = useState("")
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [childCount, setChildCount] = useState(0)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setIsLoadingClasses(true)
        setClassError(null)

        const response = await fetch('/api/children/classes')
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'クラスの取得に失敗しました')
        }

        const classes = result.data?.classes || []
        setClassOptions(classes)

        if (classes.length > 0 && !selectedClass) {
          setSelectedClass(classes[0].class_id)
        }
      } catch (err) {
        console.error('Failed to fetch classes:', err)
        setClassError(err instanceof Error ? err.message : 'クラスの取得に失敗しました')
      } finally {
        setIsLoadingClasses(false)
      }
    }

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

    fetchClasses()
    fetchActivities()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // AI音声で下書き作成（モック）
  const handleVoiceDraft = async () => {
    setIsAiLoading(true)
    
    // モック: 1.5秒後にAI生成テキストを挿入
    setTimeout(() => {
      const draft = `今日は雨のため室内で過ごしました。新聞紙遊びを取り入れたところ、子どもたちは大喜びでした。

@りゅうくん は、最初は破るのをためらっていましたが、保育者が手本を見せると真似をして、ビリビリという音を楽しんでいました。細長くちぎった新聞紙を「ヘビさんだよ！」と見立てて嬉しそうに見せてくれました。

@ひなちゃん は、丸めた新聞紙をボールにして「えいっ！」と投げる遊びに夢中でした。お友達に当たらないよう、周りを見て投げる姿に成長を感じました。`
      
      // タイピングエフェクト
      let i = 0
      setActivityContent("")
      const typeWriter = setInterval(() => {
        if (i < draft.length) {
          setActivityContent(prev => prev + draft.charAt(i))
          i++
        } else {
          clearInterval(typeWriter)
          setChildCount(2)
          highlightMentions()
        }
      }, 10)
      
      setIsAiLoading(false)
    }, 1500)
  }

  const highlightMentions = () => {
    // メンションハイライトのロジック（後で実装）
    console.log('Highlighting mentions...')
  }

  const toggleAnalysisModal = () => {
    setShowAnalysisModal(!showAnalysisModal)
  }

  return (
    <StaffLayout title="活動記録" subtitle="クラスの活動記録一覧">
      <div className="space-y-6">
        {/* 記録入力フォーム */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>活動記録の入力</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded border border-indigo-100 font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Gemini Pro 搭載
                </span>
                <Button variant="ghost" size="sm" className="text-sm font-bold">
                  下書き保存
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-gray-500 mb-1">クラス</Label>
                <Select
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                  disabled={isLoadingClasses || classOptions.length === 0}
                >
                  <SelectTrigger className="w-full bg-gray-50 font-bold">
                    <SelectValue
                      placeholder={
                        isLoadingClasses ? 'クラスを取得中...' : 'クラスを選択'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((cls) => (
                      <SelectItem key={cls.class_id} value={cls.class_id}>
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {classError && (
                  <p className="mt-2 text-xs text-red-600">{classError}</p>
                )}
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-500 mb-1">日付</Label>
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="bg-gray-50 font-bold"
                />
              </div>
            </div>

            {/* 活動内容入力 */}
            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm font-bold text-gray-700">活動内容</Label>
                <Button
                  onClick={handleVoiceDraft}
                  disabled={isAiLoading}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow hover:shadow-md hover:scale-105 transition flex items-center gap-1"
                >
                  <Mic className="w-3 h-3" />
                  ✨ AI音声で下書き作成
                </Button>
              </div>
              
              <div className="relative">
                <Textarea
                  value={activityContent}
                  onChange={(e) => setActivityContent(e.target.value)}
                  placeholder="手入力するか、上の「AI音声で下書き」ボタンを押して喋ってください。&#10;Geminiが綺麗な文章に整えます。"
                  className="min-h-64 text-base leading-relaxed resize-none"
                />
                
                {/* AI生成中のローディング */}
                {isAiLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-10">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs font-bold text-indigo-600 animate-pulse">
                        Geminiが文章を整えています...
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-400 mt-2 text-right">
                「今日は雨で室内遊び。りゅうくんは新聞紙破いて楽しそうだった」のように箇条書きでもOK！
              </p>
            </div>

            {/* 写真添付 */}
            <div>
              <Label className="text-sm font-bold text-gray-700 mb-2 block">写真</Label>
              <div className="grid grid-cols-4 gap-2">
                <button className="aspect-square bg-white border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px]">追加</span>
                </button>
              </div>
            </div>

            {/* 下部アクションバー */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-xs text-gray-500">
                <span className="font-bold text-gray-800">{childCount}名</span> の児童を検出中
              </div>
              <Button
                onClick={toggleAnalysisModal}
                className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                AI解析で個別記録を作成
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI解析モーダル */}
        {showAnalysisModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex justify-between items-center">
                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  AI解析結果 (Gemini)
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleAnalysisModal}
                  className="text-gray-400"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              
              <div className="flex-1 bg-gray-100 p-6 overflow-y-auto">
                {/* サンプル結果カード */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs">
                        り
                      </span>
                      りゅうくん
                    </h4>
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded font-bold">
                      信頼度: 高
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-bold text-gray-500">抽出された事実</Label>
                      <p className="text-sm bg-gray-50 p-2 rounded text-gray-700">
                        新聞紙を破る音を楽しんでいた。細長くちぎって「ヘビさん」と見立てていた。
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-gray-500">AI推奨タグ</Label>
                      <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100 font-bold">
                          # 想像力
                        </span>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100 font-bold">
                          # 模倣
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <Button
                  onClick={toggleAnalysisModal}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm"
                >
                  確定して保存
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">エラー: {error}</p>
          </div>
        )}

        {/* 記録一覧 */}
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
