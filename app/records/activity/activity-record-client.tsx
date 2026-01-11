"use client"

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Mic, Sparkles, X, Edit2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import DOMPurify from "dompurify"
import {
  type AiObservationDraft as AiObservationResult,
  loadAiDraftsFromCookie,
  persistAiDraftsToCookie,
} from "@/lib/drafts/aiDraftCookie"
import { replaceChildIdsWithNames } from "@/lib/ai/childIdFormatter"

interface IndividualRecord {
  observation_id: string
  child_id: string
  child_name: string
}

interface Activity {
  activity_id: string
  activity_date: string
  title: string
  content: string
  snack: string | null
  photos: Array<ActivityPhoto | string>
  class_name: string
  class_id?: string
  created_by: string
  created_at: string
  individual_record_count: number
  individual_records: IndividualRecord[]
  mentioned_children?: string[]
}

interface ActivityPhoto {
  url: string
  caption?: string | null
  thumbnail_url?: string | null
  file_id?: string
  file_path?: string
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
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionSearchQuery, setMentionSearchQuery] = useState("")
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [mentionLoading, setMentionLoading] = useState(false)
  const [mentionError, setMentionError] = useState<string | null>(null)
  const [selectedMentions, setSelectedMentions] = useState<MentionSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null)
  const [mentionTokens, setMentionTokens] = useState<Map<string, string>>(new Map())
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
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // 編集モードの状態
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [originalMentionedChildren, setOriginalMentionedChildren] = useState<string[]>([])
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<ActivityPhoto[]>([])
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const ACTIVITY_CONTENT_MAX = 10000
  const MAX_PHOTOS = 6
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024
  const MENTION_TRIGGERS = ['@', '＠']
  const mentionTriggerRef = useRef<'textarea' | 'button'>('button')

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
    if (!query) return children
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

  const handleClassChange = (value: string) => {
    setSelectedClass(value)
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
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
    const cursorPos = event.target.selectionStart
    setActivityContent(value)
    updateMentionedChildren(value)

    // @検出：開始位置を記録
    if (MENTION_TRIGGERS.includes(value.slice(-1))) {
      setMentionStartIndex(cursorPos - 1)
      mentionTriggerRef.current = 'textarea'
      setShowMentionPicker(true)
      setMentionSearchQuery('')
      setSelectedIndex(0)
      return
    }

    // メンション中：@以降の文字を検索クエリに
    if (showMentionPicker && mentionStartIndex !== null) {
      const query = value.slice(mentionStartIndex + 1, cursorPos)
      setMentionSearchQuery(query)
      setSelectedIndex(0)
    }
  }

  const closeMentionPicker = () => {
    setShowMentionPicker(false)
    setMentionSearchQuery('')
    setMentionStartIndex(null)
    setSelectedIndex(0)
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionPicker) return

    const filteredChildren = filterSuggestions(classChildren, mentionSearchQuery)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < filteredChildren.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredChildren.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredChildren[selectedIndex]) {
          handleMentionSelect(filteredChildren[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        closeMentionPicker()
        break
    }
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
    setSaveError(null)
    setSaveMessage(null)

    try {
      if (selectedMentions.length === 0) {
        throw new Error('メンションされた児童がありません')
      }

      // 1. 先に活動記録を保存（編集モードの場合は更新）
      let savedActivityId: string | null = editingActivityId

      if (isEditMode && editingActivityId) {
        // 編集モードの場合は更新
        const updateResponse = await fetch(`/api/activities/${editingActivityId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            class_id: selectedClass,
            activity_date: activityDate,
            content: activityContent,
            mentioned_children: selectedMentions.map((child) => child.child_id),
            photos,
          }),
        })

        const updateResult = await updateResponse.json()

        if (!updateResponse.ok || !updateResult.success) {
          throw new Error(updateResult.error || '活動記録の更新に失敗しました')
        }

        setSaveMessage('活動記録を更新しました')
      } else {
        // 新規保存
        const saveResponse = await fetch('/api/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            class_id: selectedClass,
            activity_date: activityDate,
            content: activityContent,
            mentioned_children: selectedMentions.map((child) => child.child_id),
            photos,
          }),
        })

        const saveResult = await saveResponse.json()

        if (!saveResponse.ok || !saveResult.success) {
          throw new Error(saveResult.error || '活動記録の保存に失敗しました')
        }

        savedActivityId = saveResult.data?.activity_id
        setSaveMessage('活動記録を保存しました')

        // 新規保存後は編集モードに切り替え
        setEditingActivityId(savedActivityId)
        setIsEditMode(true)
      }

      // 2. AI分析を実行
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
          activity_id: savedActivityId, // 保存した活動記録IDを紐付け
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'AI分析に失敗しました')
      }

      const analysisResults = result.data?.analysis_results || []
      setAiAnalysisResults(analysisResults)
      setShowAnalysisModal(true)
      persistAiDraftsToCookie(analysisResults)

      // 活動記録一覧を更新
      fetchActivities()
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
          photos,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存に失敗しました')
      }

      setActivityContent("")
      setSelectedMentions([])
      setMentionTokens(new Map())
      setPhotos([])
      setPhotoUploadError(null)
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
          photos,
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
      setPhotos([])
      setPhotoUploadError(null)
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
    const mappedPhotos = (activity.photos || [])
      .map((photo) => (typeof photo === 'string' ? { url: photo } : photo))
      .filter(Boolean) as ActivityPhoto[]
    setPhotos(mappedPhotos)
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
    setSavingObservationId(result.draft_id)

    try {
      const aiResponse = await fetch('/api/records/personal/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: result.content,
        }),
      })

      const aiResult = await aiResponse.json()

      if (!aiResponse.ok || !aiResult.success) {
        throw new Error(aiResult.error || 'AI解析に失敗しました')
      }

      const response = await fetch('/api/records/personal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          child_id: result.child_id,
          observation_date: result.observation_date,
          content: result.content,
          activity_id: result.activity_id ?? editingActivityId ?? null,
          ai_action: aiResult.data?.objective ?? '',
          ai_opinion: aiResult.data?.subjective ?? '',
          tag_flags: aiResult.data?.flags ?? {},
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '保存に失敗しました')
      }

      setAiAnalysisResults((prev) => {
        const updated = prev.map((item) =>
          item.draft_id === result.draft_id ? { ...item, status: 'saved' as const, observation_id: data.data.id } : item
        )
        persistAiDraftsToCookie(updated)
        return updated
      })

      // 保存成功のメッセージ表示（オプション）
      setSaveMessage(`${result.child_display_name}の記録を保存しました`)
    } catch (err) {
      console.error('Failed to save observation:', err)
      setAiAnalysisError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSavingObservationId(null)
    }
  }

  const handleDeleteObservation = (result: AiObservationResult) => {
    setAiAnalysisResults((prev) => prev.filter((item) => item.draft_id !== result.draft_id))
    persistAiDraftsToCookie(
      aiAnalysisResults.filter((item) => item.draft_id !== result.draft_id)
    )
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditingActivityId(null)
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
    setOriginalMentionedChildren([])
    setPhotos([])
    setPhotoUploadError(null)
  }

  const handleRestart = () => {
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
    setPhotos([])
    setPhotoUploadError(null)
  }

  const handleMentionSelect = (mention: MentionSuggestion) => {
    // 既に選択済みの場合は追加しない
    if (selectedMentions.find((m) => m.unique_key === mention.unique_key)) {
      closeMentionPicker()
      return
    }

    const token = `@${mention.display_name} `

    if (mentionStartIndex !== null) {
      // @〜カーソル位置を置換
      const cursorPos = textareaRef.current?.selectionStart ?? activityContent.length
      const before = activityContent.slice(0, mentionStartIndex)
      const after = activityContent.slice(cursorPos)
      setActivityContent(before + token + after)
    } else {
      // ボタンから開いた場合（フォールバック）
      setActivityContent(prev => prev + token)
    }

    setSelectedMentions((prev) => [...prev, mention])
    setMentionTokens((prev) => new Map(prev).set(mention.unique_key, token.trim()))
    closeMentionPicker()
  }

  const handlePhotoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const remainingSlots = MAX_PHOTOS - photos.length
    if (remainingSlots <= 0) {
      setPhotoUploadError(`写真は最大${MAX_PHOTOS}枚までです`)
      event.target.value = ''
      return
    }

    const uploadTargets = files.slice(0, remainingSlots)
    const uploaded: ActivityPhoto[] = []
    const errors: string[] = []

    setIsUploadingPhotos(true)
    setPhotoUploadError(null)

    for (const file of uploadTargets) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: 画像ファイルのみアップロードできます`)
        continue
      }
      if (file.size > MAX_PHOTO_SIZE) {
        errors.push(`${file.name}: 5MB以下のファイルを選択してください`)
        continue
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('activity_date', activityDate)

        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || '写真のアップロードに失敗しました')
        }

        uploaded.push({
          url: result.data.url,
          thumbnail_url: result.data.thumbnail_url,
          caption: result.data.caption ?? null,
          file_id: result.data.file_id,
          file_path: result.data.file_path,
        })
      } catch (error) {
        console.error('Failed to upload photo:', error)
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'アップロードに失敗しました'}`)
      }
    }

    if (uploaded.length > 0) {
      setPhotos((prev) => [...prev, ...uploaded])
    }
    if (errors.length > 0) {
      setPhotoUploadError(errors.join('\n'))
    }

    setIsUploadingPhotos(false)
    event.target.value = ''
  }

  const removePhoto = (fileId?: string, index?: number) => {
    setPhotos((prev) => {
      if (fileId) {
        return prev.filter((photo) => photo.file_id !== fileId)
      }
      if (typeof index === 'number') {
        return prev.filter((_, idx) => idx !== index)
      }
      return prev
    })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Failed to start recording:', error)
      setSaveError('音声録音の開始に失敗しました')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true)
      setSaveError(null)

      const formData = new FormData()
      formData.append('audio', audioBlob)

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '文字起こしに失敗しました')
      }

      const transcribedText = result.text
      setActivityContent((prev) => prev + (prev ? '\n' : '') + transcribedText)
    } catch (error) {
      console.error('Failed to transcribe:', error)
      setSaveError(error instanceof Error ? error.message : '文字起こしに失敗しました')
    } finally {
      setIsTranscribing(false)
    }
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

  const formatAnalysisContentForResult = (
    result: AiObservationResult,
    content: string
  ) => {
    if (!content) return content
    const nameById = new Map<string, string>()
    selectedMentions.forEach((mention) => {
      nameById.set(mention.child_id, mention.display_name)
    })
    if (result.child_id && result.child_display_name) {
      nameById.set(result.child_id, result.child_display_name)
    }
    return replaceChildIdsWithNames(content, nameById)
  }

  const getEditUrl = (result: AiObservationResult) => {
    if (result.status === "saved" && result.observation_id) {
      return `/records/personal/${result.observation_id}/edit`
    }
    const params = new URLSearchParams()
    if (result.draft_id) params.set("draftId", result.draft_id)
    if (result.child_id) params.set("childId", result.child_id)
    if (result.child_display_name) params.set("childName", result.child_display_name)
    if (result.activity_id) params.set("activityId", result.activity_id)
    const query = params.toString()
    return query ? `/records/personal/new?${query}` : "/records/personal/new"
  }

  return (
    <StaffLayout title="活動記録" subtitle="1日の活動のまとめを記録">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>活動記録の入力</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="activityContent" className="text-base font-semibold">活動内容</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{selectedMentions.length}人</span>
                  <span>・</span>
                  <span>{activityContent.length}/{ACTIVITY_CONTENT_MAX}文字</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // @を末尾に挿入
                    const newContent = activityContent + '@'
                    setActivityContent(newContent)
                    // mentionStartIndexを設定
                    setMentionStartIndex(newContent.length - 1)
                    mentionTriggerRef.current = 'button'
                    setShowMentionPicker(true)
                    setMentionSearchQuery('')
                    setSelectedIndex(0)
                    // フォーカスしてカーソルを末尾に
                    setTimeout(() => {
                      textareaRef.current?.focus()
                      textareaRef.current?.setSelectionRange(newContent.length, newContent.length)
                    }, 0)
                  }}
                  disabled={!selectedClass || classChildren.length === 0}
                >
                  <span className="mr-1">@</span>
                  児童をメンション
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isRecording ? "destructive" : "outline"}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                >
                  <Mic className={`mr-2 h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
                  {isRecording ? '停止' : isTranscribing ? '文字起こし中...' : '音声入力'}
                </Button>
              </div>

              <Popover
                open={showMentionPicker}
                onOpenChange={(open) => {
                  if (!open) closeMentionPicker()
                }}
              >
                <PopoverTrigger asChild>
                  <div className="sr-only" aria-hidden="true" />
                </PopoverTrigger>
                <Textarea
                  ref={textareaRef}
                  id="activityContent"
                  rows={12}
                  value={activityContent}
                  onChange={handleContentChange}
                  onKeyDown={handleTextareaKeyDown}
                  maxLength={ACTIVITY_CONTENT_MAX}
                  placeholder="園での活動内容を入力してください&#10;&#10;ヒント: @を入力すると児童選択モーダルが開きます"
                  className="min-h-[300px]"
                />

                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={32}
                  className="w-64 max-h-[300px] p-2"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {mentionLoading ? (
                    <p className="text-center py-4 text-sm text-muted-foreground">読み込み中...</p>
                  ) : classChildren.length > 0 ? (
                    <div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto">
                      {filterSuggestions(classChildren, mentionSearchQuery).map((child, index) => {
                        const isHighlighted = index === selectedIndex
                        return (
                          <button
                            key={child.unique_key}
                            type="button"
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm",
                              isHighlighted ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                            )}
                            onClick={() => handleMentionSelect(child)}
                            onMouseEnter={() => setSelectedIndex(index)}
                          >
                            <div className="font-medium">{child.display_name}</div>
                            <div className="text-xs opacity-70">{child.class_name}</div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-sm text-muted-foreground">
                      児童が見つかりません
                    </p>
                  )}
                </PopoverContent>
              </Popover>
              {mentionError && <p className="text-sm text-red-500">{mentionError}</p>}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">写真</Label>
                <span className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS}枚</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  multiple
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhotos || photos.length >= MAX_PHOTOS}
                >
                  写真を追加
                </Button>
                <span className="text-xs text-muted-foreground">JPEG/PNG/WEBP・最大5MB</span>
                {isUploadingPhotos && (
                  <span className="text-xs text-muted-foreground">アップロード中...</span>
                )}
              </div>
              {photoUploadError && (
                <p className="text-sm text-red-500 whitespace-pre-line">{photoUploadError}</p>
              )}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.file_id ?? `${photo.url}-${index}`}
                      className="relative overflow-hidden rounded-lg border"
                    >
                      <img
                        src={photo.thumbnail_url || photo.url}
                        alt="活動写真"
                        className="h-32 w-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-7 w-7 rounded-full bg-white/80 text-foreground hover:bg-white"
                        onClick={() => removePhoto(photo.file_id, index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedMentions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">メンション中の児童</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedMentions.map((mention) => (
                    <span
                      key={mention.unique_key}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-sm font-medium"
                    >
                      {mention.display_name}
                      <button
                        type="button"
                        className="hover:text-primary/80 transition-colors"
                        onClick={() => removeMention(mention)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-wrap gap-3 flex-1">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isAiLoading || !activityContent.trim()}
                  onClick={handleAnalyze}
                  className="flex-1 sm:flex-none"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI分析
                </Button>
                {isEditMode ? (
                  <>
                    <Button type="button" onClick={handleUpdate} disabled={isSaving || isUploadingPhotos} className="flex-1 sm:flex-none">
                      <Edit2 className="mr-2 h-4 w-4" />
                      更新
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelEdit} className="flex-1 sm:flex-none">
                      キャンセル
                    </Button>
                  </>
                ) : (
                  <Button type="button" onClick={handleSave} disabled={isSaving || isUploadingPhotos || !activityContent.trim()} className="flex-1 sm:flex-none">
                    保存
                  </Button>
                )}
              </div>
              <Button type="button" variant="ghost" onClick={handleRestart}>
                リセット
              </Button>
            </div>
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            {saveMessage && <p className="text-sm text-green-600">{saveMessage}</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">活動記録一覧</h2>
          </div>

          {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">読み込み中...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-red-500">{error}</p>
              </CardContent>
            </Card>
          ) : activitiesData?.activities.length ? (
            <div className="space-y-3">
              {activitiesData.activities.map((activity) => (
                <Card key={activity.activity_id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                              {activity.activity_date}
                            </span>
                            <span className="text-sm font-medium text-muted-foreground">
                              {activity.class_name}
                            </span>
                          </div>
                          <div className="text-sm leading-relaxed mt-2">
                            <div
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(convertToMarkdown(activity.content)),
                              }}
                            />
                          </div>
                          {Array.isArray(activity.photos) && activity.photos.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {activity.photos.map((photo, index) => {
                                const url =
                                  typeof photo === "string"
                                    ? photo
                                    : photo.thumbnail_url || photo.url
                                if (!url) return null
                                return (
                                  <div
                                    key={typeof photo === "string" ? `${photo}-${index}` : photo.file_id ?? `${photo.url}-${index}`}
                                    className="overflow-hidden rounded-lg border"
                                  >
                                    <img src={url} alt="活動写真" className="h-24 w-full object-cover" />
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(activity)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(activity.activity_id)}
                            disabled={isDeletingId === activity.activity_id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex flex-col gap-2 flex-1">
                          <span className="text-xs text-muted-foreground">
                            {activity.individual_record_count}件の個別記録
                          </span>
                          {activity.individual_records && activity.individual_records.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {activity.individual_records.map((record) => (
                                <Button
                                  key={record.observation_id}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs hover:bg-primary/10"
                                  onClick={() => router.push(`/records/personal/${record.observation_id}/edit`)}
                                >
                                  {record.child_name}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          作成: {activity.created_by}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">活動記録はまだありません。</p>
                <p className="text-sm text-muted-foreground mt-2">上のフォームから記録を追加してください。</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={showAnalysisModal} onOpenChange={(open) => !open && closeModal()}>
          <DialogContent className="max-h-[90vh] w-full max-w-4xl overflow-y-auto">
            <DialogHeader className="mb-4 flex flex-row items-center justify-between">
              <DialogTitle>AI分析結果</DialogTitle>
              <Button variant="ghost" size="icon" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            {aiAnalysisError && <p className="text-sm text-red-500">{aiAnalysisError}</p>}
            {isAiLoading || isAnalyzing ? (
              <p>分析中...</p>
            ) : aiAnalysisResults.length ? (
              <div className="space-y-4">
                {aiAnalysisResults.map((result) => (
                  <Card key={result.draft_id}>
                    <CardContent className="space-y-2 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{result.child_display_name}</p>
                          <p className="font-medium">
                            {formatAnalysisContentForResult(result, result.content)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveObservation(result)}
                            disabled={savingObservationId === result.draft_id || result.status === "saved"}
                          >
                            {result.status === "saved" ? "保存済み" : "保存"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(getEditUrl(result))}
                          >
                            編集
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
                        <p className="text-xs text-green-600">個別記録として保存されました</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">分析結果がありません。</p>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </StaffLayout>
  )
}
