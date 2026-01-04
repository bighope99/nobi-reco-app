"use client"

import { useState, useEffect, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Mic, Sparkles, Camera, X, Edit2, Trash2 } from "lucide-react"
import {
  type AiObservationDraft as AiObservationResult,
  loadAiDraftsFromCookie,
  persistAiDraftsToCookie,
} from "@/lib/drafts/aiDraftCookie"

interface Activity {
  activity_id: string
  activity_date: string
  title: string
  content: string
  snack: string | null
  photos: any[]
  class_name: string
  class_id?: string
  created_by: string
  created_at: string
  individual_record_count: number
  mentioned_children?: string[]
}

interface MentionSuggestion {
  child_id: string
  name: string
  kana: string
  nickname?: string
  grade?: string
  class_name?: string
  photo_url?: string | null
  display_name: string
  unique_key: string
}

interface ActivitiesData {
  activities: Activity[]
  total: number
  has_more: boolean
}

// AiObservationResult型は共通ファイルからimport済み

export default function ActivityRecordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activitiesData, setActivitiesData] = useState<ActivitiesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 記録入力フォームの状態
  const [selectedClass, setSelectedClass] = useState("")
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0])
  const [activityContent, setActivityContent] = useState("")
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [childCount, setChildCount] = useState(0)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([])
  const [isMentionOpen, setIsMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionLoading, setMentionLoading] = useState(false)
  const [mentionError, setMentionError] = useState<string | null>(null)
  const [selectedMentions, setSelectedMentions] = useState<MentionSuggestion[]>([])
  const [mentionTokens, setMentionTokens] = useState<Map<string, string>>(new Map())
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  const [isLoadingClasses, setIsLoadingClasses] = useState(false)
  const [classOptions, setClassOptions] = useState<
    { class_id: string; class_name: string }[]
  >([])
  const [classError, setClassError] = useState<string | null>(null)
  const [classChildren, setClassChildren] = useState<MentionSuggestion[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [aiAnalysisResults, setAiAnalysisResults] = useState<AiObservationResult[]>([])
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [savingObservationId, setSavingObservationId] = useState<string | null>(null)
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 編集モードの状態
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [originalMentionedChildren, setOriginalMentionedChildren] = useState<string[]>([])
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

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

        if (classes.length > 0) {
          setSelectedClass((prev) => prev || classes[0].class_id)
        }
      } catch (err) {
        console.error('Failed to fetch classes:', err)
        setClassError(err instanceof Error ? err.message : 'クラスの取得に失敗しました')
      } finally {
        setIsLoadingClasses(false)
      }
    }

    fetchClasses()
  }, [])

  const fetchActivities = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    const syncDrafts = () => {
      const shouldShowSaved = searchParams?.get("aiModal") === "1"
      if (shouldShowSaved && typeof window !== "undefined") {
        const raw = window.sessionStorage.getItem("nobiRecoAiLastSavedDraft")
        if (raw) {
          try {
            const draft = JSON.parse(raw) as AiObservationResult
            setAiAnalysisResults([draft])
            if (draft.activity_id) {
              setEditingActivityId(draft.activity_id)
            }
            setShowAnalysisModal(true)
            window.sessionStorage.removeItem("nobiRecoAiLastSavedDraft")
            return
          } catch (error) {
            console.error("Failed to parse last saved draft:", error)
          }
        }
      }

      const drafts = loadAiDraftsFromCookie().filter((draft) => draft.status !== "saved")
      if (drafts.length === 0) return
      setAiAnalysisResults(drafts)
      const activityId = drafts[0]?.activity_id
      if (activityId) {
        setEditingActivityId(activityId)
      }
      setShowAnalysisModal(true)
    }

    syncDrafts()

    const handleFocus = () => syncDrafts()
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [searchParams])

  const toHiragana = (text: string) =>
    text.replace(/[\u30a1-\u30f6]/g, (match) =>
      String.fromCharCode(match.charCodeAt(0) - 0x60)
    )

  const toKatakana = (text: string) =>
    text.replace(/[\u3041-\u3096]/g, (match) =>
      String.fromCharCode(match.charCodeAt(0) + 0x60)
    )

  const normalizeKana = (text: string) =>
    toKatakana(text.toLowerCase().replace(/\s/g, ""))

  const normalizeQuery = (text: string) =>
    normalizeKana(text)

  const normalizeName = (name: string) =>
    normalizeKana(name)

  const filterSuggestions = (children: MentionSuggestion[], query: string) => {
    const normalizedQuery = normalizeQuery(query)
    return children.filter((child) => {
      const name = normalizeName(child.name)
      const kana = normalizeName(child.kana)
      const nickname = child.nickname ? normalizeName(child.nickname) : ""
      return (
        name.includes(normalizedQuery) ||
        kana.includes(normalizedQuery) ||
        nickname.includes(normalizedQuery)
      )
    })
  }

  const updateMentionSuggestions = useCallback(
    (query: string) => {
      if (!query) {
        setMentionSuggestions([])
        return
      }

      const filtered = filterSuggestions(classChildren, query)
      setMentionSuggestions(filtered)
    },
    [classChildren]
  )

  const handleClassChange = (value: string) => {
    setSelectedClass(value)
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
    setMentionSuggestions([])
    setMentionQuery("")
    setMentionStart(null)
    setActiveMentionIndex(0)
  }

  const extractMentionToken = (query: string) => {
    if (!query) return null
    return query.replace(/^@/, "")
  }

  const updateMentionQuery = (value: string, cursorPosition: number | null) => {
    if (cursorPosition === null) return
    const text = value.slice(0, cursorPosition)
    const match = /@([^\s@]*)$/.exec(text)
    if (match) {
      const query = match[1]
      setMentionQuery(query)
      setIsMentionOpen(true)
      setMentionStart(cursorPosition - query.length - 1)
      updateMentionSuggestions(query)
    } else {
      setMentionQuery("")
      setIsMentionOpen(false)
      setMentionStart(null)
      setMentionSuggestions([])
    }
  }

  const handleMentionSelect = (mention: MentionSuggestion) => {
    if (mentionStart === null) return

    const before = activityContent.slice(0, mentionStart)
    const after = activityContent.slice(mentionStart + mentionQuery.length + 1)
    const token = `@${mention.display_name}`
    const updated = `${before}${token}${after}`

    setActivityContent(updated)
    setSelectedMentions((prev) => [...prev, mention])
    setMentionTokens((prev) => new Map(prev).set(mention.unique_key, token))

    setMentionQuery("")
    setIsMentionOpen(false)
    setMentionStart(null)
    setMentionSuggestions([])

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const cursor = before.length + token.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(cursor, cursor)
      }
    })
  }

  const removeMention = (mention: MentionSuggestion) => {
    const token = mentionTokens.get(mention.unique_key)
    if (!token) return

    setActivityContent((prev) => prev.replace(token, "").replace(/\s{2,}/g, " ").trim())
    setSelectedMentions((prev) => prev.filter((item) => item.unique_key !== mention.unique_key))
    setMentionTokens((prev) => {
      const next = new Map(prev)
      next.delete(mention.unique_key)
      return next
    })
  }

  const updateMentionedChildren = (content: string) => {
    const nextTokens = new Map(mentionTokens)
    for (const [key, token] of nextTokens) {
      if (!content.includes(token)) {
        nextTokens.delete(key)
      }
    }

    if (nextTokens.size === mentionTokens.size) return

    setMentionTokens(nextTokens)
    setSelectedMentions((prev) => prev.filter((mention) => nextTokens.has(mention.unique_key)))
  }

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    setActivityContent(value)
    updateMentionQuery(value, event.target.selectionStart)
    updateMentionedChildren(value)
  }

  const handleContentKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isMentionOpen || mentionSuggestions.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveMentionIndex((prev) => (prev + 1) % mentionSuggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveMentionIndex((prev) =>
        (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      handleMentionSelect(mentionSuggestions[activeMentionIndex])
    }
  }

  const handleMentionBlur = () => {
    setTimeout(() => {
      setIsMentionOpen(false)
    }, 100)
  }

  const loadClassChildren = useCallback(
    async (classId: string) => {
      if (!classId) return

      try {
        setMentionLoading(true)
        setMentionError(null)

        const response = await fetch(`/api/children?class_id=${classId}`)
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || "児童の取得に失敗しました")
        }

        const children = (result.data?.children || []).map((child: any) => ({
          child_id: child.child_id,
          name: child.name,
          kana: child.kana,
          nickname: child.nickname,
          grade: child.grade,
          class_name: child.class_name,
          photo_url: child.photo_url,
          display_name: child.nickname || child.name,
          unique_key: child.child_id,
        })) as MentionSuggestion[]

        setClassChildren(children)
      } catch (err) {
        console.error("Failed to load class children:", err)
        setMentionError(err instanceof Error ? err.message : "児童の取得に失敗しました")
      } finally {
        setMentionLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedClass) {
      loadClassChildren(selectedClass)
    }
  }, [selectedClass, loadClassChildren])

  const handleAnalyze = async () => {
    setIsAiLoading(true)
    setAiAnalysisError(null)

    try {
      const response = await fetch('/api/ai/observation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: selectedClass,
          content: activityContent,
          activity_date: activityDate,
          mentioned_children: selectedMentions.map((child) => child.child_id),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '分析に失敗しました')
      }

      setAiAnalysisResults(result.data?.analysis_results || [])
      setShowAnalysisModal(true)
      persistAiDraftsToCookie(result.data?.analysis_results || [])
    } catch (err) {
      console.error('Failed to analyze:', err)
      setAiAnalysisError(err instanceof Error ? err.message : '分析に失敗しました')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: selectedClass,
          activity_date: activityDate,
          content: activityContent,
          mentioned_children: selectedMentions.map((child) => child.child_id),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存に失敗しました')
      }

      setActivityContent("")
      setSelectedMentions([])
      setMentionTokens(new Map())
      setSaveMessage('保存しました')
      fetchActivities()
    } catch (err) {
      console.error('Failed to save:', err)
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingActivityId) return

    setIsSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      const response = await fetch(`/api/activities/${editingActivityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: selectedClass,
          activity_date: activityDate,
          content: activityContent,
          mentioned_children: selectedMentions.map((child) => child.child_id),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新に失敗しました')
      }

      setSaveMessage('更新しました')
      setIsEditMode(false)
      setEditingActivityId(null)
      setActivityContent("")
      setSelectedMentions([])
      setMentionTokens(new Map())
      fetchActivities()
    } catch (err) {
      console.error('Failed to update:', err)
      setSaveError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (activity: Activity) => {
    setEditingActivityId(activity.activity_id)
    setIsEditMode(true)
    setActivityContent(activity.content)
    setActivityDate(activity.activity_date)
    setSelectedClass(activity.class_id || '')
    setOriginalMentionedChildren(activity.mentioned_children || [])
  }

  const handleDelete = async (activityId: string) => {
    const confirmed = window.confirm("この活動記録を削除しますか？")
    if (!confirmed) return

    setIsDeletingId(activityId)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '削除に失敗しました')
      }

      fetchActivities()
    } catch (err) {
      console.error('Failed to delete:', err)
      setDeleteError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsDeletingId(null)
    }
  }

  const closeModal = () => {
    setShowAnalysisModal(false)
    setAiAnalysisResults([])
    setAiAnalysisError(null)
  }

  const handleSaveObservation = async (result: AiObservationResult) => {
    setSavingObservationId(result.activity_id)

    try {
      const response = await fetch(`/api/activities/${result.activity_id}/observations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          observation: result.content,
          mention_children: (result as any).mentioned_children || [],
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '保存に失敗しました')
      }

      setAiAnalysisResults((prev) => {
        const updated = prev.map((item) =>
          item.activity_id === result.activity_id ? { ...item, status: 'saved' as const } : item
        )
        persistAiDraftsToCookie(updated)
        return updated
      })

      if (result.activity_id) {
        window.sessionStorage.setItem("nobiRecoAiLastSavedDraft", JSON.stringify(result))
      }

      router.push("/records/activity?aiModal=1")
    } catch (err) {
      console.error('Failed to save observation:', err)
      setAiAnalysisError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSavingObservationId(null)
    }
  }

  const handleDeleteObservation = (result: AiObservationResult) => {
    setAiAnalysisResults((prev) => prev.filter((item) => item.activity_id !== result.activity_id))
    persistAiDraftsToCookie(
      aiAnalysisResults.filter((item) => item.activity_id !== result.activity_id)
    )
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditingActivityId(null)
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
    setOriginalMentionedChildren([])
  }

  const handleRestart = () => {
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
  }

  const handleMentionClick = (mention: MentionSuggestion) => {
    handleMentionSelect(mention)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("text")
    const cursorPosition = event.currentTarget.selectionStart
    const value = activityContent
    const updated = value.slice(0, cursorPosition) + pastedText + value.slice(cursorPosition)
    updateMentionQuery(updated, cursorPosition + pastedText.length)
  }

  const convertToMarkdown = (text: string) =>
    text
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>")
      .replace(/\*(.*)\*/gim, "<em>$1</em>")
      .replace(/\n\n/gim, "<br/><br/>")
      .replace(/\n/gim, "<br/>")

  return (
    <StaffLayout title="活動記録" subtitle="1日の活動のまとめを記録">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>活動記録の入力</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="class">クラス</Label>
              <Select value={selectedClass} onValueChange={handleClassChange}>
                <SelectTrigger>
                  <SelectValue placeholder="クラスを選択" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((classOption) => (
                    <SelectItem key={classOption.class_id} value={classOption.class_id}>
                      {classOption.class_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {classError && <p className="text-sm text-red-500">{classError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="activityDate">日付</Label>
              <Input
                id="activityDate"
                type="date"
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="activityContent">活動内容</Label>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{childCount}人</span>
                  <span>・</span>
                  <span>{activityContent.length}文字</span>
                </div>
              </div>
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  id="activityContent"
                  rows={8}
                  value={activityContent}
                  onChange={handleContentChange}
                  onKeyDown={handleContentKeyDown}
                  onBlur={handleMentionBlur}
                  onPaste={handlePaste}
                  placeholder="園での活動内容を入力してください"
                />
                {isMentionOpen && mentionSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow">
                    <ul className="max-h-48 overflow-y-auto">
                      {mentionSuggestions.map((child, index) => (
                        <li
                          key={child.unique_key}
                          className={`cursor-pointer px-3 py-2 text-sm hover:bg-muted ${
                            index === activeMentionIndex ? "bg-muted" : ""
                          }`}
                          onMouseDown={() => handleMentionClick(child)}
                        >
                          <div className="font-medium">{child.display_name}</div>
                          <div className="text-xs text-muted-foreground">{child.class_name}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {mentionError && <p className="text-sm text-red-500">{mentionError}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedMentions.map((mention) => (
                <span
                  key={mention.unique_key}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                >
                  {mention.display_name}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeMention(mention)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isAiLoading || !activityContent.trim()}
                onClick={handleAnalyze}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI分析
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || !activityContent.trim()}>
                <Mic className="mr-2 h-4 w-4" />
                保存
              </Button>
              <Button type="button" variant="outline" onClick={handleRestart}>
                リセット
              </Button>
              {isEditMode ? (
                <>
                  <Button type="button" onClick={handleUpdate} disabled={isSaving}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    更新
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                    キャンセル
                  </Button>
                </>
              ) : null}
            </div>
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>活動記録一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
            {loading ? (
              <p>読み込み中...</p>
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : activitiesData?.activities.length ? (
              <div className="space-y-4">
                {activitiesData.activities.map((activity) => (
                  <Card key={activity.activity_id}>
                    <CardContent className="space-y-2 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{activity.activity_date}</p>
                          <p className="font-medium">{activity.class_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(activity)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(activity.activity_id)}
                            disabled={isDeletingId === activity.activity_id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div
                          dangerouslySetInnerHTML={{ __html: convertToMarkdown(activity.content) }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {activity.individual_record_count}件の個別記録
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">活動記録はまだありません。</p>
            )}
          </CardContent>
        </Card>

        {showAnalysisModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">AI分析結果</h2>
                <Button variant="ghost" size="icon" onClick={closeModal}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {aiAnalysisError && <p className="text-sm text-red-500">{aiAnalysisError}</p>}
              {isAiLoading || isAnalyzing ? (
                <p>分析中...</p>
              ) : aiAnalysisResults.length ? (
                <div className="space-y-4">
                  {aiAnalysisResults.map((result) => (
                    <Card key={result.activity_id}>
                      <CardContent className="space-y-2 pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{result.child_display_name}</p>
                            <p className="font-medium">{result.content}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveObservation(result)}
                              disabled={savingObservationId === result.activity_id}
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteObservation(result)}
                            >
                              削除
                            </Button>
                          </div>
                        </div>
                        {result.status === "saved" && (
                          <p className="text-xs text-green-600">保存済み</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">分析結果がありません。</p>
              )}
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
