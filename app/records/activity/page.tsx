"use client"

import { useState, useEffect, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
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

interface AiObservationResult {
  draft_id: string
  activity_id: string | null
  child_id: string
  child_display_name: string
  observation_date: string
  content: string
  status: "pending" | "saved"
  observation_id?: string
}

const AI_DRAFT_COOKIE = "nobiRecoAiDrafts"

const readCookieValue = (name: string) => {
  if (typeof document === "undefined") return null
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
  if (!cookie) return null
  return cookie.split("=").slice(1).join("=")
}

const loadAiDraftsFromCookie = () => {
  const raw = readCookieValue(AI_DRAFT_COOKIE)
  if (!raw) return []
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AiObservationResult[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error("Failed to parse AI drafts cookie:", error)
    return []
  }
}

const persistAiDraftsToCookie = (drafts: AiObservationResult[]) => {
  if (typeof document === "undefined") return
  const pendingDrafts = drafts.filter((draft) => draft.status !== "saved")
  if (pendingDrafts.length === 0) {
    document.cookie = `${AI_DRAFT_COOKIE}=; path=/; max-age=0`
    return
  }
  const value = encodeURIComponent(JSON.stringify(pendingDrafts))
  document.cookie = `${AI_DRAFT_COOKIE}=${value}; path=/; max-age=86400`
}

export default function ActivityRecordPage() {
  const router = useRouter()
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
  }, [])

  const toHiragana = (text: string) =>
    text.replace(/[ァ-ン]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0x60),
    )

  const normalizeForSearch = (text: string) => toHiragana(text.trim().toLowerCase())

  const filterMentionSuggestions = useCallback(
    (query: string) => {
      const normalizedQuery = normalizeForSearch(query)

      const filteredSuggestions = classChildren.filter((child) => {
        if (!normalizedQuery) return true

        const searchTargets = [
          child.display_name,
          child.kana,
          child.nickname,
        ]
          .filter(Boolean)
          .map((target) => normalizeForSearch(target as string))

        return searchTargets.some((target) => target.includes(normalizedQuery))
      })

      setMentionSuggestions(filteredSuggestions)
      setActiveMentionIndex(0)
      setIsMentionOpen(filteredSuggestions.length > 0)
    },
    [classChildren],
  )

  useEffect(() => {
    const fetchClassChildren = async () => {
      if (!selectedClass) return

      try {
        setMentionLoading(true)
        setMentionError(null)
        setClassChildren([])

        const params = new URLSearchParams({
          class_id: selectedClass,
        })

        const response = await fetch(`/api/children/mention-suggestions?${params.toString()}`)
        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "メンション候補の取得に失敗しました")
        }

        if (result.success) {
          setClassChildren(result.data.suggestions)
        }
      } catch (err) {
        setMentionError(err instanceof Error ? err.message : "メンション候補の取得に失敗しました")
      } finally {
        setMentionLoading(false)
      }
    }

    setMentionSuggestions([])
    setSelectedMentions([])
    setMentionTokens(new Map())
    setIsMentionOpen(false)
    setMentionQuery("")
    setMentionStart(null)

    fetchClassChildren()
  }, [selectedClass])

  useEffect(() => {
    if (mentionStart === null) return

    filterMentionSuggestions(mentionQuery)
  }, [mentionQuery, filterMentionSuggestions, mentionStart, classChildren])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  const [isRecording, setIsRecording] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsAiLoading(true)
      setVoiceStatus('Geminiが文字起こし中です...')

      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '音声の文字起こしに失敗しました')
      }

      const transcript = (result.text as string).trim()
      if (!transcript) {
        throw new Error('文字起こしの結果が空でした')
      }

      setActivityContent((prev) => {
        const prefix = prev.trim() ? `${prev}\n` : ''
        return `${prefix}${transcript}`
      })
      setVoiceStatus('文字起こしが完了しました')
    } catch (err) {
      console.error('Voice draft failed:', err)
      setVoiceError(err instanceof Error ? err.message : '音声の処理に失敗しました')
      setVoiceStatus(null)
    } finally {
      setIsAiLoading(false)
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setIsRecording(false)
  }

  const startRecording = async () => {
    try {
      setVoiceError(null)
      setVoiceStatus('録音しています... もう一度押すと停止します。')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        if (audioBlob.size === 0) {
          setVoiceError('音声データが取得できませんでした。もう一度お試しください。')
          setVoiceStatus(null)
          return
        }

        await transcribeAudio(audioBlob)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setVoiceError('マイクの利用が許可されているか確認してください。')
      setVoiceStatus(null)
      setIsRecording(false)
    }
  }

  const handleVoiceDraft = async () => {
    if (isRecording) {
      stopRecording()
      return
    }

    if (!('MediaRecorder' in window) || !navigator.mediaDevices) {
      setVoiceError('このブラウザでは音声録音を利用できません。')
      return
    }

    await startRecording()
  }

  const updateMentionMetrics = (content: string) => {
    const mentionNames = new Set<string>()
    const mentionRegex = /[@＠]([^\s@＠]+)/g
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      mentionNames.add(match[1])
    }

    setChildCount(mentionNames.size)
  }

  useEffect(() => {
    updateMentionMetrics(activityContent)

    setSelectedMentions((prev) =>
      prev.filter(
        (mention) =>
          activityContent.includes(`@${mention.display_name}`) ||
          activityContent.includes(`＠${mention.display_name}`),
      ),
    )
  }, [activityContent])

  useEffect(() => {
    if (!isMentionOpen) {
      setActiveMentionIndex(0)
      return
    }

    setActiveMentionIndex((prev) => {
      if (mentionSuggestions.length === 0) return 0
      return Math.min(prev, mentionSuggestions.length - 1)
    })
  }, [mentionSuggestions, isMentionOpen])

  const detectMention = (value: string, cursorPosition: number | null) => {
    const cursor = cursorPosition ?? value.length
    const textBeforeCursor = value.slice(0, cursor)
    const mentionMatch = textBeforeCursor.match(/[@＠]([^\s@＠]*)$/)

    if (mentionMatch) {
      const latestMentionStart = Math.max(textBeforeCursor.lastIndexOf("@"), textBeforeCursor.lastIndexOf("＠"))

      if (latestMentionStart === -1) return

      setMentionQuery(mentionMatch[1])
      setMentionStart(latestMentionStart)
      filterMentionSuggestions(mentionMatch[1])
    } else {
      setMentionQuery("")
      setMentionStart(null)
      setIsMentionOpen(false)
    }
  }

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart } = e.target
    setActivityContent(value)
    detectMention(value, selectionStart)
  }

  const handleMentionNavigation = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isMentionOpen || mentionSuggestions.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveMentionIndex((prev) => (prev + 1) % mentionSuggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveMentionIndex((prev) =>
        prev === 0 ? mentionSuggestions.length - 1 : prev - 1,
      )
    } else if (event.key === "Enter") {
      event.preventDefault()
      const activeSuggestion = mentionSuggestions[activeMentionIndex]
      if (activeSuggestion) {
        handleSelectMention(activeSuggestion)
      }
    } else if (event.key === "Escape") {
      setIsMentionOpen(false)
    }
  }

  const handleSelectMention = async (suggestion: MentionSuggestion) => {
    if (mentionStart === null) return

    const mentionEnd = mentionStart + 1 + mentionQuery.length
    const before = activityContent.slice(0, mentionStart)
    const after = activityContent.slice(mentionEnd)
    const newContent = `${before}@${suggestion.display_name} ${after}`

    setActivityContent(newContent)
    setIsMentionOpen(false)

    setSelectedMentions((prev) => {
      if (prev.some((item) => item.unique_key === suggestion.unique_key)) {
        return prev
      }
      return [...prev, suggestion]
    })

    // Fetch encrypted token for this child
    if (!mentionTokens.has(suggestion.child_id)) {
      try {
        const response = await fetch('/api/mentions/encrypt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            childId: suggestion.child_id,
          }),
        })

        const result = await response.json()

        if (response.ok && result.encryptedToken) {
          setMentionTokens((prev) => {
            const newMap = new Map(prev)
            newMap.set(suggestion.child_id, result.encryptedToken)
            return newMap
          })
        } else {
          console.error('Failed to encrypt child ID:', result.error)
        }
      } catch (err) {
        console.error('Error fetching encrypted token:', err)
      }
    }
  }

  const insertMentionAtCursor = () => {
    const textarea = textareaRef.current
    const triggerChar = "@"

    if (!textarea) return

    const start = textarea.selectionStart ?? activityContent.length
    const end = textarea.selectionEnd ?? start

    const newContent = `${activityContent.slice(0, start)}${triggerChar}${activityContent.slice(end)}`
    const nextCursor = start + triggerChar.length

    setActivityContent(newContent)
    detectMention(newContent, nextCursor)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const toggleAnalysisModal = () => {
    setShowAnalysisModal(!showAnalysisModal)
  }

  const handleEditActivity = (activity: Activity) => {
    // 編集モードに入る
    setIsEditMode(true)
    setEditingActivityId(activity.activity_id)

    // フォームに活動記録のデータを設定
    setActivityDate(activity.activity_date)
    setActivityContent(activity.content)

    // クラスを設定
    if (activity.class_id) {
      setSelectedClass(activity.class_id)
    }

    // 既存のmentioned_childrenを保存
    setOriginalMentionedChildren(activity.mentioned_children || [])

    // メンション表示をクリア（編集時は既存メンションを表示しない）
    setSelectedMentions([])
    setMentionTokens(new Map())

    // フォームエリアにスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // 保存/エラーメッセージをクリア
    setSaveMessage(null)
    setSaveError(null)
    setAiAnalysisError(null)
  }

  const handleCancelEdit = () => {
    // 編集モードをキャンセル
    setIsEditMode(false)
    setEditingActivityId(null)
    setOriginalMentionedChildren([])

    // フォームをクリア
    setActivityContent('')
    setSelectedMentions([])
    setMentionTokens(new Map())
    setIsMentionOpen(false)

    // メッセージをクリア
    setSaveMessage(null)
    setSaveError(null)
    setAiAnalysisError(null)
  }

  const handleDeleteActivity = async (activity: Activity) => {
    if (!confirm('この活動記録を削除しますか？この操作は元に戻せません。')) return

    try {
      setIsDeletingId(activity.activity_id)
      setError(null)

      const response = await fetch('/api/records/activity', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ activity_id: activity.activity_id }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '削除に失敗しました')
      }

      if (isEditMode && editingActivityId === activity.activity_id) {
        handleCancelEdit()
      }

      setActivitiesData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          activities: prev.activities.filter(
            (item) => item.activity_id !== activity.activity_id,
          ),
          total: Math.max(prev.total - 1, 0),
        }
      })
      setSaveMessage('活動記録を削除しました')
    } catch (err) {
      console.error('Failed to delete activity:', err)
      setError(err instanceof Error ? err.message : '削除に失敗しました')
    } finally {
      setIsDeletingId(null)
    }
  }

  const handleAiAnalysis = async () => {
    // Validation
    if (!selectedClass) {
      setAiAnalysisError('クラスを選択してください')
      return
    }

    if (!activityDate) {
      setAiAnalysisError('日付を入力してください')
      return
    }

    if (!activityContent.trim()) {
      setAiAnalysisError('活動内容を入力してください')
      return
    }

    if (selectedMentions.length === 0) {
      setAiAnalysisError('メンションされた子供がいません。@を使って子供をメンションしてください。')
      return
    }

    // Gather encrypted tokens
    const encryptedTokens: string[] = []
    for (const mention of selectedMentions) {
      const token = mentionTokens.get(mention.child_id)
      if (token) {
        encryptedTokens.push(token)
      } else {
        console.warn(`No encrypted token found for child ${mention.child_id}`)
      }
    }

    if (encryptedTokens.length === 0) {
      setAiAnalysisError('暗号化トークンの取得に失敗しました。もう一度お試しください。')
      return
    }

    try {
      setIsAnalyzing(true)
      setAiAnalysisError(null)
      setAiAnalysisResults([])

      const response = await fetch('/api/records/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(editingActivityId && { activity_id: editingActivityId }),
          activity_date: activityDate,
          class_id: selectedClass,
          content: activityContent.trim(),
          mentioned_children: encryptedTokens,
          ai_preview: true,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'AI解析に失敗しました')
      }

      if (result.activity?.id) {
        setEditingActivityId(result.activity.id)
        setOriginalMentionedChildren(result.activity.mentioned_children || encryptedTokens)
      }

      const activityId = result.activity?.id || editingActivityId || null
      const formattedResults: AiObservationResult[] = (result.observations || []).map((obs: any, index: number) => {
        const child = selectedMentions.find((m) => m.child_id === obs.child_id)
        const draftId = typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${obs.child_id}-${Date.now()}-${index}`
        return {
          draft_id: draftId,
          activity_id: activityId,
          child_id: obs.child_id,
          child_display_name: child?.display_name || '不明',
          observation_date: obs.observation_date,
          content: obs.content,
          status: 'pending',
        }
      })

      setAiAnalysisResults(formattedResults)
      persistAiDraftsToCookie(formattedResults)
      setShowAnalysisModal(true)

      // Show success message
      if (result.message) {
        setSaveMessage(result.message)
      }

      // Refresh activities list
      await fetchActivities()
    } catch (err) {
      console.error('AI analysis failed:', err)
      setAiAnalysisError(err instanceof Error ? err.message : 'AI解析に失敗しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApproveObservation = async (draft: AiObservationResult) => {
    if (!editingActivityId) {
      setAiAnalysisError('活動記録がまだ保存されていません。先にAI解析を実行してください。')
      return
    }

    try {
      setSavingObservationId(draft.draft_id)
      setAiAnalysisError(null)

      const response = await fetch('/api/records/observation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activity_id: editingActivityId,
          child_id: draft.child_id,
          content: draft.content,
          observation_date: draft.observation_date,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '個別記録の保存に失敗しました')
      }

      setAiAnalysisResults((prev) => {
        const next = prev.map((item) =>
          item.draft_id === draft.draft_id
            ? {
                ...item,
                status: 'saved',
                observation_id: result.data?.id,
                content: result.data?.content ?? item.content,
                observation_date: result.data?.observation_date ?? item.observation_date,
              }
            : item,
        )
        persistAiDraftsToCookie(next)
        return next
      })
      setSaveMessage('個別記録を保存しました')
      await fetchActivities()
    } catch (err) {
      console.error('Failed to save observation:', err)
      setAiAnalysisError(err instanceof Error ? err.message : '個別記録の保存に失敗しました')
    } finally {
      setSavingObservationId(null)
    }
  }

  const handleDeleteObservationDraft = async (draft: AiObservationResult) => {
    // 未保存の場合はローカル削除
    if (draft.status !== 'saved' || !draft.observation_id) {
      setAiAnalysisResults((prev) => {
        const next = prev.filter((item) => item.draft_id !== draft.draft_id)
        persistAiDraftsToCookie(next)
        return next
      })
      return
    }

    try {
      setDeletingObservationId(draft.draft_id)
      const response = await fetch('/api/records/observation', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          observation_id: draft.observation_id,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '個別記録の削除に失敗しました')
      }

      setAiAnalysisResults((prev) => {
        const next = prev.filter((item) => item.draft_id !== draft.draft_id)
        persistAiDraftsToCookie(next)
        return next
      })
      setSaveMessage('個別記録を削除しました')
      await fetchActivities()
    } catch (err) {
      console.error('Failed to delete observation:', err)
      setAiAnalysisError(err instanceof Error ? err.message : '個別記録の削除に失敗しました')
    } finally {
      setDeletingObservationId(null)
    }
  }

  const handleEditObservation = (draft: AiObservationResult) => {
    if (draft.observation_id) {
      router.push(`/records/personal/${draft.observation_id}/edit`)
      return
    }
    router.push(`/records/personal/new?draftId=${draft.draft_id}`)
  }

  const handleSaveActivity = async () => {
    if (!selectedClass) {
      setSaveError('クラスを選択してください')
      return
    }

    if (!activityDate) {
      setSaveError('日付を入力してください')
      return
    }

    if (!activityContent.trim()) {
      setSaveError('活動内容を入力してください')
      return
    }

    try {
      setIsSaving(true)
      setSaveError(null)
      setSaveMessage(null)

      // 編集モードか新規作成モードかを判定
      const isUpdate = Boolean(editingActivityId)

      // mentioned_childrenを準備（暗号化トークンの配列）
      // 編集モード: 新しいメンションがあればそれを使用、なければ既存のものを使用
      // 新規作成モード: 新しいメンションを使用
      let mentionedChildren: string[]
      if (isUpdate) {
        const newMentions = Array.from(mentionTokens.values())
        mentionedChildren = newMentions.length > 0 ? newMentions : originalMentionedChildren
      } else {
        mentionedChildren = Array.from(mentionTokens.values())
      }

      const response = await fetch('/api/records/activity', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(isUpdate && { activity_id: editingActivityId }),
          activity_date: activityDate,
          class_id: selectedClass,
          content: activityContent.trim(),
          mentioned_children: mentionedChildren,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || `活動記録の${isUpdate ? '更新' : '保存'}に失敗しました`)
      }

      setSaveMessage(isUpdate ? '活動記録を更新しました' : '活動記録を保存しました')

      // 編集モードをリセット
      if (isUpdate) {
        setIsEditMode(false)
        setEditingActivityId(null)
        setOriginalMentionedChildren([])
      }

      // フォームをクリア
      setActivityContent('')
      setSelectedMentions([])
      setMentionTokens(new Map())
      setIsMentionOpen(false)

      await fetchActivities()
    } catch (err) {
      console.error('Failed to save activity:', err)
      setSaveError(err instanceof Error ? err.message : `活動記録の${isEditMode ? '更新' : '保存'}に失敗しました`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <StaffLayout title="活動記録" subtitle="クラスの活動記録一覧">
      <div className="space-y-6">
        {/* 記録入力フォーム */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>
                  {isEditMode ? '活動記録の編集' : '活動記録の入力'}
                </CardTitle>
                {isEditMode && (
                  <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200 font-bold">
                    編集中
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm font-bold"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    キャンセル
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-sm font-bold"
                  onClick={handleSaveActivity}
                  disabled={isSaving}
                >
                  {isSaving ? '保存中...' : isEditMode ? '更新' : '保存'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(saveError || saveMessage || aiAnalysisError) && (
              <div className="text-sm font-bold">
                {saveError && <p className="text-red-600">{saveError}</p>}
                {aiAnalysisError && <p className="text-red-600">{aiAnalysisError}</p>}
                {saveMessage && <p className="text-green-600">{saveMessage}</p>}
              </div>
            )}
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
                <Label className="text-xs font-bold text-gray-500 mb-1">活動日</Label>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={insertMentionAtCursor}
                    className="text-xs font-bold"
                  >
                    @ メンション挿入
                  </Button>
                  <Button
                    onClick={handleVoiceDraft}
                    disabled={isAiLoading}
                    className={`text-white text-xs px-3 py-1.5 rounded-full font-bold shadow transition flex items-center gap-1 ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-md hover:scale-105'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    {isRecording ? '録音停止' : 'AI音声で下書き作成'}
                  </Button>
                </div>
              </div>
              
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={activityContent}
                  onChange={handleContentChange}
                  onKeyDown={handleMentionNavigation}
                  placeholder="手入力するか、上の「AI音声で下書き」ボタンを押して喋ってください。&#10;Geminiが綺麗な文章に整えます。"
                  className="min-h-64 text-base leading-relaxed resize-none"
                />

                {(voiceStatus || voiceError) && (
                  <div className="mt-2 space-y-1">
                    {voiceStatus && (
                      <p className="text-[11px] text-indigo-700 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        {voiceStatus}
                      </p>
                    )}
                    {voiceError && (
                      <p className="text-[11px] text-red-600 font-bold">{voiceError}</p>
                    )}
                  </div>
                )}

                {isMentionOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 max-h-56 overflow-y-auto rounded-lg border bg-white shadow-lg z-20">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 text-xs text-gray-500">
                      <span className="font-bold">メンション候補</span>
                      <span>{mentionQuery ? `"${mentionQuery}"` : "全候補"}</span>
                    </div>
                    {mentionLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500">読み込み中...</div>
                    ) : mentionError ? (
                      <div className="px-4 py-3 text-sm text-red-600">{mentionError}</div>
                    ) : mentionSuggestions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">候補が見つかりません</div>
                    ) : (
                      <ul className="divide-y" role="listbox">
                        {mentionSuggestions.map((suggestion, index) => (
                          <li key={suggestion.unique_key}>
                            <button
                              type="button"
                              onClick={() => handleSelectMention(suggestion)}
                              className={`w-full px-4 py-3 text-left transition flex items-center justify-between ${
                                index === activeMentionIndex ? "bg-indigo-50" : "hover:bg-indigo-50"
                              }`}
                              role="option"
                              aria-selected={index === activeMentionIndex}
                            >
                              <div>
                                <p className="font-bold text-gray-800">@{suggestion.display_name}</p>
                                <p className="text-xs text-gray-500">{suggestion.kana}</p>
                                {suggestion.nickname && (
                                  <p className="text-[11px] text-gray-500">あだ名: {suggestion.nickname}</p>
                                )}
                              </div>
                              {suggestion.class_name && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100 font-bold">
                                  {suggestion.class_name}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selectedMentions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedMentions.map((mention) => (
                      <span
                        key={mention.unique_key}
                        className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100 font-bold"
                      >
                        @{mention.display_name}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* AI生成中のローディング */}
                {isAiLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-10">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs font-bold text-indigo-600 animate-pulse">
                        文章を整えています...
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-400 mt-2 text-right">
                AI解析で個別記録の下書きが生成されます。@マークを入力すると候補が表示されます。キーボードの上下キーで選択、Enterで確定できます。
              </p>
            </div>

            {/* 写真アップロード */}
            <div>
              <Label className="text-sm font-bold text-gray-700 mb-2 block">写真</Label>
              <div className="grid grid-cols-4 gap-2">
                <button className="aspect-square bg-white border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 transition">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-[10px]">追加</span>
                </button>
              </div>
            </div>

            {/* 選択されたメンション */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-xs text-gray-500">
                <span className="font-bold text-gray-800">{childCount}名</span> の児童を検出中
              </div>
                <Button
                  onClick={handleAiAnalysis}
                  disabled={isAnalyzing || selectedMentions.length === 0}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5" />
                  {isAnalyzing ? 'AI解析中...' : 'AI解析で下書きを作成'}
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
                {aiAnalysisResults.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="font-bold">AI解析結果が見つかりません</p>
                  </div>
                ) : (
                  aiAnalysisResults.map((observation) => {
                    const displayName = observation.child_display_name
                    const initial = displayName.charAt(0)
                    const isSaved = observation.status === 'saved'

                    return (
                      <div key={observation.draft_id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs">
                              {initial}
                            </span>
                            {displayName}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              isSaved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isSaved ? '保存済み' : '未保存'}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs font-bold text-gray-500">AIが生成した個別記録</Label>
                            <p className="text-sm bg-gray-50 p-3 rounded text-gray-700 leading-relaxed">
                              {observation.content}
                            </p>
                          </div>
                          <div className="text-xs text-gray-400">
                            記録日: {observation.observation_date}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end mt-4">
                          <Button
                            size="sm"
                            className="bg-indigo-600 text-white"
                            disabled={isSaved || savingObservationId === observation.draft_id}
                            onClick={() => handleApproveObservation(observation)}
                          >
                            {savingObservationId === observation.draft_id ? '保存中...' : isSaved ? '保存済み' : '保存'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deletingObservationId === observation.draft_id}
                            onClick={() => handleDeleteObservationDraft(observation)}
                          >
                            {deletingObservationId === observation.draft_id ? '削除中...' : '削除'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditObservation(observation)}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            編集
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <Button
                  onClick={toggleAnalysisModal}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm"
                >
                  閉じる
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
                          <span>記録者： {activity.created_by}</span>
                          {activity.individual_record_count > 0 && (
                            <span>個別記録: {activity.individual_record_count}件</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditActivity(activity)}
                          disabled={isDeletingId === activity.activity_id}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteActivity(activity)}
                          disabled={isDeletingId === activity.activity_id}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {isDeletingId === activity.activity_id ? '削除中' : '削除'}
                        </Button>
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
