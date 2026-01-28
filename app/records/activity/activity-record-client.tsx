"use client"

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { StaffLayout } from "@/components/layout/staff-layout"
import { getCurrentDateJST } from "@/lib/utils/timezone"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Mic, Sparkles, X, Edit2, Trash2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import DOMPurify from "dompurify"
import {
  type AiObservationDraft as AiObservationResult,
  loadAiDraftsFromCookie,
  persistAiDraftsToCookie,
} from "@/lib/drafts/aiDraftCookie"
import { replaceChildIdsWithNames } from "@/lib/ai/childIdFormatter"
import { convertToDisplayNames, convertToPlaceholders, buildNameToIdMap } from "@/lib/mention/mentionFormatter"
import type { ActivityPhoto, DailyScheduleItem, RoleAssignment, Meal } from "@/types/activity"
import { sanitizeText, sanitizeArrayFields, sanitizeObjectFields } from "@/lib/security/sanitize"
import {
  MAX_EVENT_NAME_LENGTH,
  MAX_SPECIAL_NOTES_LENGTH,
  MAX_SNACK_LENGTH,
  MAX_SCHEDULE_CONTENT_LENGTH,
  MAX_ROLE_LENGTH,
  MAX_MEAL_MENU_LENGTH,
  MAX_MEAL_ITEMS_LENGTH,
  MAX_MEAL_NOTES_LENGTH,
} from "@/lib/validation/activityValidation"
import { getSanitizedExtendedFields as getSanitizedExtendedFieldsUtil } from "@/lib/activity/sanitizeExtendedFields"

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
  mentioned_children_names?: Record<string, string>
  // 新規拡張フィールド
  event_name?: string | null
  daily_schedule?: DailyScheduleItem[]
  role_assignments?: RoleAssignment[]
  special_notes?: string | null
  meal?: Meal | null
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

interface StaffMember {
  user_id: string
  name: string
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
  const [activityDate, setActivityDate] = useState(getCurrentDateJST())
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
  const [transcriptionTarget, setTranscriptionTarget] = useState<'activityContent' | 'specialNotes'>('activityContent')
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
  const [originalContent, setOriginalContent] = useState<string>("")

  // 新規フィールドの状態
  const [eventName, setEventName] = useState("")
  // デフォルト5行、初期値10:00
  const DEFAULT_SCHEDULE: DailyScheduleItem[] = [
    { time: "10:00", content: "" },
    { time: "10:00", content: "" },
    { time: "10:00", content: "" },
    { time: "10:00", content: "" },
    { time: "10:00", content: "" },
  ]
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleItem[]>(DEFAULT_SCHEDULE)
  // デフォルト2行
  const DEFAULT_ROLE_ASSIGNMENTS: RoleAssignment[] = [
    { user_id: "", user_name: "", role: "" },
    { user_id: "", user_name: "", role: "" },
  ]
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(DEFAULT_ROLE_ASSIGNMENTS)
  const [snack, setSnack] = useState("")
  const [meal, setMeal] = useState<Meal | null>(null)
  const [specialNotes, setSpecialNotes] = useState("")
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [isLoadingStaff, setIsLoadingStaff] = useState(false)
  const ACTIVITY_CONTENT_MAX = 10000
  const MAX_PHOTOS = 6
  const MAX_PHOTO_SIZE = 5 * 1024 * 1024
  const MENTION_TRIGGERS = ['@', '＠']
  const mentionTriggerRef = useRef<'textarea' | 'button'>('button')
  const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'br', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
  }

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

  // 職員リストを取得
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setIsLoadingStaff(true)
        const response = await fetch('/api/users?is_active=true')
        const result = await response.json()

        if (response.ok && result.success) {
          const users = result.data?.users || []
          setStaffList(users.map((u: { user_id: string; name: string }) => ({
            user_id: u.user_id,
            name: u.name,
          })))
        }
      } catch (err) {
        console.error('Failed to fetch staff:', err)
      } finally {
        setIsLoadingStaff(false)
      }
    }

    fetchStaff()
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

    // @検出：カーソル位置の直前の文字を確認（テキスト中間でも検出可能）
    const justTypedChar = cursorPos > 0 ? value.charAt(cursorPos - 1) : ''
    if (MENTION_TRIGGERS.includes(justTypedChar)) {
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

  // メンションピッカーの外部クリックで閉じる
  const mentionPickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showMentionPicker) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        mentionPickerRef.current &&
        !mentionPickerRef.current.contains(target) &&
        textareaRef.current &&
        !textareaRef.current.contains(target)
      ) {
        closeMentionPicker()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMentionPicker])

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

  const loadChildren = useCallback(
    async (classId?: string) => {
      try {
        setMentionLoading(true)
        setMentionError(null)

        // classIdがあればフィルタリング、なければ施設全体の児童を取得
        const url = classId ? `/api/children?class_id=${classId}` : '/api/children'
        const response = await fetch(url)
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || "児童の取得に失敗しました")
        }

        const children = (result.data?.children || []).map((child: {
          child_id: string;
          name: string;
          kana: string;
          nickname?: string;
          grade?: string;
          class_name?: string;
          photo_url?: string | null;
        }) => ({
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

  const getSanitizedExtendedFields = () => {
    return getSanitizedExtendedFieldsUtil({
      dailySchedule,
      roleAssignments,
      snack,
      meal,
      specialNotes,
      eventName,
    })
  }

  // クラスがない施設: 初期ロード時に全児童取得
  // クラスがある施設: クラス選択時のみ児童取得（大規模施設対応）
  useEffect(() => {
    if (classes.length === 0) {
      // クラスがない施設は全児童を取得
      loadChildren(undefined)
    } else if (selectedClass) {
      // クラスがある施設は選択されたクラスの児童のみ取得
      loadChildren(selectedClass)
    } else {
      // クラスがある施設でクラス未選択時は児童リストをクリア
      setClassChildren([])
    }
  }, [classes.length, selectedClass, loadChildren])

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

      const sanitizedFields = getSanitizedExtendedFields()

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
            // 新規フィールド（サニタイズ済み）
            event_name: sanitizedFields.event_name,
            daily_schedule: sanitizedFields.daily_schedule,
            role_assignments: sanitizedFields.role_assignments,
            snack: sanitizedFields.snack,
            meal: sanitizedFields.meal,
            special_notes: sanitizedFields.special_notes,
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
            // 新規フィールド（サニタイズ済み）
            event_name: sanitizedFields.event_name,
            daily_schedule: sanitizedFields.daily_schedule,
            role_assignments: sanitizedFields.role_assignments,
            snack: sanitizedFields.snack,
            meal: sanitizedFields.meal,
            special_notes: sanitizedFields.special_notes,
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
      // 保存用にメンションをプレースホルダー形式に変換
      const nameToIdMap = buildNameToIdMap(selectedMentions)
      const contentForDB = convertToPlaceholders(activityContent, nameToIdMap)

      const sanitizedFields = getSanitizedExtendedFields()

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: selectedClass,
          activity_date: activityDate,
          content: contentForDB,
          mentioned_children: selectedMentions.map((child) => child.child_id),
          photos,
          // 新規フィールド（サニタイズ済み）
          event_name: sanitizedFields.event_name,
          daily_schedule: sanitizedFields.daily_schedule,
          role_assignments: sanitizedFields.role_assignments,
          snack: sanitizedFields.snack,
          meal: sanitizedFields.meal,
          special_notes: sanitizedFields.special_notes,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存に失敗しました')
      }

      // 保存成功後、編集モードに切り替え（データを維持）
      const savedActivityId = result.data?.activity_id
      setEditingActivityId(savedActivityId)
      setIsEditMode(true)
      setOriginalContent(contentForDB)
      setSaveMessage('保存しました')
      fetchActivities()

      // AI分析自動実行（観察記録+メンションがある場合のみ）
      if (contentForDB.trim() && selectedMentions.length > 0) {
        try {
          setIsAiLoading(true)
          const aiResponse = await fetch('/api/ai/observation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              class_id: selectedClass || null,
              content: contentForDB,
              activity_date: activityDate,
              mentioned_children: selectedMentions.map((child) => child.child_id),
              activity_id: savedActivityId,
            }),
          })
          const aiResult = await aiResponse.json()
          if (aiResponse.ok && aiResult.success) {
            setAiAnalysisResults(aiResult.data?.analysis_results || [])
            setShowAnalysisModal(true)
            persistAiDraftsToCookie(aiResult.data?.analysis_results || [])
          }
        } catch (err) {
          console.error('Auto AI analysis failed:', err)
        } finally {
          setIsAiLoading(false)
        }
      }
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
      // 更新用にメンションをプレースホルダー形式に変換
      const nameToIdMap = buildNameToIdMap(selectedMentions)
      const contentForDB = convertToPlaceholders(activityContent, nameToIdMap)

      const sanitizedFields = getSanitizedExtendedFields()

      const response = await fetch(`/api/activities/${editingActivityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          class_id: selectedClass,
          activity_date: activityDate,
          content: contentForDB,
          mentioned_children: selectedMentions.map((child) => child.child_id),
          photos,
          // 新規フィールド（サニタイズ済み）
          event_name: sanitizedFields.event_name,
          daily_schedule: sanitizedFields.daily_schedule,
          role_assignments: sanitizedFields.role_assignments,
          snack: sanitizedFields.snack,
          meal: sanitizedFields.meal,
          special_notes: sanitizedFields.special_notes,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '更新に失敗しました')
      }

      setSaveMessage('更新しました')
      fetchActivities()

      // AI分析は内容が変更された場合のみ実行
      if (contentForDB.trim() && selectedMentions.length > 0 && contentForDB !== originalContent) {
        try {
          setIsAiLoading(true)
          const aiResponse = await fetch('/api/ai/observation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              class_id: selectedClass || null,
              content: contentForDB,
              activity_date: activityDate,
              mentioned_children: selectedMentions.map((child) => child.child_id),
              activity_id: editingActivityId,
            }),
          })
          const aiResult = await aiResponse.json()
          if (aiResponse.ok && aiResult.success) {
            setAiAnalysisResults(aiResult.data?.analysis_results || [])
            setShowAnalysisModal(true)
            persistAiDraftsToCookie(aiResult.data?.analysis_results || [])
          }
        } catch (err) {
          console.error('Auto AI analysis failed:', err)
        } finally {
          setIsAiLoading(false)
        }
      }
      setOriginalContent(contentForDB)
    } catch (err) {
      console.error('Failed to update:', err)
      setSaveError(err instanceof Error ? err.message : '更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async (activity: Activity) => {
    setEditingActivityId(activity.activity_id)
    setIsEditMode(true)
    // @[child_id] 形式を @表示名 形式に変換して表示
    const idToNameMap = new Map(Object.entries(activity.mentioned_children_names || {}))
    const displayContent = convertToDisplayNames(activity.content, idToNameMap)
    setActivityContent(displayContent)
    setActivityDate(activity.activity_date)
    setSelectedClass(activity.class_id || '')
    setOriginalMentionedChildren(activity.mentioned_children || [])
    setOriginalContent(activity.content || "")

    // 写真を復元
    const mappedPhotos = (activity.photos || [])
      .map((photo) => (typeof photo === 'string' ? { url: photo } : photo))
      .filter(Boolean) as ActivityPhoto[]
    setPhotos(mappedPhotos)

    // 新規フィールドを復元（デフォルト値と一貫性を保つ）
    setEventName(activity.event_name || "")
    setDailySchedule(activity.daily_schedule && activity.daily_schedule.length > 0
      ? activity.daily_schedule
      : DEFAULT_SCHEDULE)
    setRoleAssignments(activity.role_assignments && activity.role_assignments.length > 0
      ? activity.role_assignments
      : DEFAULT_ROLE_ASSIGNMENTS)
    setSnack(activity.snack || "")
    setMeal(activity.meal || null)
    setSpecialNotes(activity.special_notes || "")

    // メンション復元: クラスの児童リストから名前情報を取得
    if (activity.mentioned_children && activity.mentioned_children.length > 0) {
      // クラスが異なる場合は児童リストを再取得する必要があるため、APIから取得
      let children = classChildren
      if (activity.class_id && activity.class_id !== selectedClass) {
        try {
          const response = await fetch(`/api/children?class_id=${activity.class_id}`)
          const result = await response.json()
          if (response.ok && result.success) {
            children = (result.data?.children || []).map((child: {
              child_id: string;
              name: string;
              kana: string;
              nickname?: string;
              grade?: string;
              class_name?: string;
              photo_url?: string | null;
            }) => ({
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
          }
        } catch (err) {
          console.error('Failed to fetch children for mention restoration:', err)
        }
      }

      // mentioned_children からメンション情報を復元
      const childMap = new Map<string, MentionSuggestion>()
      children.forEach((child) => childMap.set(child.child_id, child))

      const restoredMentions: MentionSuggestion[] = []
      const newTokens = new Map<string, string>()

      activity.mentioned_children.forEach((childId) => {
        const child = childMap.get(childId)
        if (child) {
          restoredMentions.push(child)
          newTokens.set(child.unique_key, `@[${childId}]`)
        } else {
          // 児童リストに存在しない場合は最小限の情報で復元
          const fallbackMention: MentionSuggestion = {
            child_id: childId,
            name: childId,
            kana: '',
            display_name: childId,
            unique_key: childId,
          }
          restoredMentions.push(fallbackMention)
          newTokens.set(childId, `@[${childId}]`)
        }
      })

      setSelectedMentions(restoredMentions)
      setMentionTokens(newTokens)
    } else {
      // メンションがない場合はクリア
      setSelectedMentions([])
      setMentionTokens(new Map())
    }
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
    // 新規フィールドもリセット
    setEventName("")
    setDailySchedule([...DEFAULT_SCHEDULE])
    setRoleAssignments([...DEFAULT_ROLE_ASSIGNMENTS])
    setSnack("")
    setMeal(null)
    setSpecialNotes("")
  }

  const handleRestart = () => {
    setActivityContent("")
    setSelectedMentions([])
    setMentionTokens(new Map())
    setPhotos([])
    setPhotoUploadError(null)
    // 新規フィールドもリセット
    setEventName("")
    setDailySchedule([...DEFAULT_SCHEDULE])
    setRoleAssignments([...DEFAULT_ROLE_ASSIGNMENTS])
    setSnack("")
    setMeal(null)
    setSpecialNotes("")
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

  const startRecording = async (target: 'activityContent' | 'specialNotes' = 'activityContent') => {
    try {
      setTranscriptionTarget(target)
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
      if (transcriptionTarget === 'specialNotes') {
        setSpecialNotes((prev) => prev + (prev ? '\n' : '') + transcribedText)
      } else {
        setActivityContent((prev) => prev + (prev ? '\n' : '') + transcribedText)
      }
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

  // 表示用にcontentを変換（@[child_id]を表示名に変換）
  const getDisplayContent = (activity: Activity) => {
    if (!activity.mentioned_children_names) return activity.content
    const idToNameMap = new Map(Object.entries(activity.mentioned_children_names))
    return convertToDisplayNames(activity.content, idToNameMap)
  }

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

            {/* 今日の行事・イベント */}
            <div className="space-y-2">
              <Label htmlFor="eventName">今日の行事・イベント</Label>
              <Input
                id="eventName"
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="例: 運動会、遠足、誕生日会"
                maxLength={MAX_EVENT_NAME_LENGTH}
              />
            </div>

            {/* 1日の流れ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">1日の流れ</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDailySchedule((prev) => [...prev, { time: "10:00", content: "" }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  追加
                </Button>
              </div>
              <div className="space-y-2">
                {dailySchedule.map((item, index) => {
                  // 時間フォーマットの防御的パース (HH:MM形式を想定)
                  const timeParts = (item.time || '10:00').split(':')
                  const hours = timeParts[0] || '10'
                  const minutes = timeParts[1] || '00'
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Select
                          value={hours}
                          onValueChange={(value) => {
                            const newSchedule = [...dailySchedule]
                            newSchedule[index] = { ...item, time: `${value}:${minutes}` }
                            setDailySchedule(newSchedule)
                          }}
                        >
                          <SelectTrigger className="w-16">
                            <SelectValue placeholder="時" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">時</span>
                        <Select
                          value={minutes}
                          onValueChange={(value) => {
                            const newSchedule = [...dailySchedule]
                            newSchedule[index] = { ...item, time: `${hours}:${value}` }
                            setDailySchedule(newSchedule)
                          }}
                        >
                          <SelectTrigger className="w-16">
                            <SelectValue placeholder="分" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">分</span>
                      </div>
                      <Input
                        type="text"
                        value={item.content}
                        onChange={(e) => {
                          const newSchedule = [...dailySchedule]
                          newSchedule[index] = { ...item, content: e.target.value }
                          setDailySchedule(newSchedule)
                        }}
                        placeholder="活動内容"
                        className="flex-1"
                        maxLength={MAX_SCHEDULE_CONTENT_LENGTH}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setDailySchedule((prev) => prev.filter((_, i) => i !== index))
                        }}
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 役割分担 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">役割分担</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRoleAssignments((prev) => [...prev, { user_id: "", user_name: "", role: "" }])}
                  disabled={staffList.length === 0}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  追加
                </Button>
              </div>
              <div className="space-y-2">
                {roleAssignments.map((assignment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={assignment.user_id}
                      onValueChange={(value) => {
                        const staff = staffList.find((s) => s.user_id === value)
                        const newAssignments = [...roleAssignments]
                        newAssignments[index] = {
                          ...assignment,
                          user_id: value,
                          user_name: staff?.name || "",
                        }
                        setRoleAssignments(newAssignments)
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="職員を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map((staff) => (
                          <SelectItem key={staff.user_id} value={staff.user_id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      value={assignment.role}
                      onChange={(e) => {
                        const newAssignments = [...roleAssignments]
                        newAssignments[index] = { ...assignment, role: e.target.value }
                        setRoleAssignments(newAssignments)
                      }}
                      placeholder="役割（例: 主担当、配膳）"
                      className="flex-1"
                      maxLength={MAX_ROLE_LENGTH}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setRoleAssignments((prev) => prev.filter((_, i) => i !== index))
                      }}
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* おやつ */}
            <div className="space-y-2">
              <Label htmlFor="snack">おやつ</Label>
              <Input
                id="snack"
                type="text"
                value={snack}
                onChange={(e) => setSnack(e.target.value)}
                placeholder="例: りんご、クッキー"
                maxLength={MAX_SNACK_LENGTH}
              />
            </div>

            {/* ごはん */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">ごはん</Label>
              <div className="grid grid-cols-1 gap-3 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="mealMenu" className="text-xs text-muted-foreground">メニュー</Label>
                  <Input
                    id="mealMenu"
                    type="text"
                    value={meal?.menu || ""}
                    onChange={(e) => setMeal((prev) => ({
                      menu: e.target.value,
                      items_to_bring: prev?.items_to_bring,
                      notes: prev?.notes,
                    }))}
                    placeholder="例: カレーライス、サラダ"
                    maxLength={MAX_MEAL_MENU_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mealItems" className="text-xs text-muted-foreground">持ち物案内（任意）</Label>
                  <Input
                    id="mealItems"
                    type="text"
                    value={meal?.items_to_bring || ""}
                    onChange={(e) => setMeal((prev) => ({
                      menu: prev?.menu || "",
                      items_to_bring: e.target.value,
                      notes: prev?.notes,
                    }))}
                    placeholder="例: フォーク、スプーン"
                    maxLength={MAX_MEAL_ITEMS_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mealNotes" className="text-xs text-muted-foreground">備考（任意）</Label>
                  <Input
                    id="mealNotes"
                    type="text"
                    value={meal?.notes || ""}
                    onChange={(e) => setMeal((prev) => ({
                      menu: prev?.menu || "",
                      items_to_bring: prev?.items_to_bring,
                      notes: e.target.value,
                    }))}
                    placeholder="例: アレルギー対応済み"
                    maxLength={MAX_MEAL_NOTES_LENGTH}
                  />
                </div>
              </div>
            </div>

            {/* 観察記録（旧: 活動内容） */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="activityContent" className="text-base font-semibold">観察記録</Label>
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
                  disabled={classes.length > 0 && !selectedClass || classChildren.length === 0}
                >
                  <span className="mr-1">@</span>
                  児童をメンション
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isRecording && transcriptionTarget === 'activityContent' ? "destructive" : "outline"}
                  onClick={isRecording && transcriptionTarget === 'activityContent' ? stopRecording : () => startRecording('activityContent')}
                  disabled={isTranscribing || (isRecording && transcriptionTarget !== 'activityContent')}
                >
                  <Mic className={`mr-2 h-4 w-4 ${isRecording && transcriptionTarget === 'activityContent' ? 'animate-pulse' : ''}`} />
                  {isRecording && transcriptionTarget === 'activityContent' ? '停止' : isTranscribing && transcriptionTarget === 'activityContent' ? '文字起こし中...' : '音声入力'}
                </Button>
              </div>

              <div className="relative">
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

              {showMentionPicker && (
                <div
                  ref={mentionPickerRef}
                  className="absolute top-full left-0 mt-2 z-50 w-64 max-h-[300px] p-2 bg-popover border rounded-md shadow-md"
                  onMouseDown={(e) => e.preventDefault()}
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
                      {classes.length > 0 && !selectedClass ? "クラスを選択してください" : "児童が見つかりません"}
                    </p>
                  )}
                </div>
              )}
            </div>
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

            {/* 特記事項 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="specialNotes">特記事項</Label>
                <Button
                  type="button"
                  size="sm"
                  variant={isRecording && transcriptionTarget === 'specialNotes' ? "destructive" : "outline"}
                  onClick={isRecording && transcriptionTarget === 'specialNotes' ? stopRecording : () => startRecording('specialNotes')}
                  disabled={isTranscribing || (isRecording && transcriptionTarget !== 'specialNotes')}
                >
                  <Mic className={`mr-2 h-4 w-4 ${isRecording && transcriptionTarget === 'specialNotes' ? 'animate-pulse' : ''}`} />
                  {isRecording && transcriptionTarget === 'specialNotes' ? '停止' : isTranscribing && transcriptionTarget === 'specialNotes' ? '文字起こし中...' : '音声入力'}
                </Button>
              </div>
              <Textarea
                id="specialNotes"
                rows={4}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="その他、気になったことや共有事項があれば記入してください"
                maxLength={MAX_SPECIAL_NOTES_LENGTH}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-wrap gap-3 flex-1">
                {isEditMode ? (
                  <>
                    <Button type="button" onClick={handleUpdate} disabled={isSaving || isUploadingPhotos} className="flex-1 sm:flex-none">
                      <Edit2 className="mr-2 h-4 w-4" />
                      更新
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelEdit} className="flex-1 sm:flex-none">
                      キャンセル
                    </Button>
                    <Button type="button" variant="outline" onClick={handleRestart} className="flex-1 sm:flex-none">
                      <Plus className="mr-2 h-4 w-4" />
                      新規作成
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" onClick={handleSave} disabled={isSaving || isUploadingPhotos} className="flex-1 sm:flex-none">
                      保存
                    </Button>
                    <Button type="button" variant="ghost" onClick={handleRestart}>
                      リセット
                    </Button>
                  </>
                )}
              </div>
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
                                __html: DOMPurify.sanitize(convertToMarkdown(getDisplayContent(activity)), DOMPURIFY_CONFIG),
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
                            {activity.individual_record_count}件の児童記録
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
                        <p className="text-xs text-green-600">児童記録として保存されました</p>
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
