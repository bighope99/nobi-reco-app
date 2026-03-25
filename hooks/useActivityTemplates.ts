"use client"

import { useState, useEffect, useCallback } from "react"
import type { DailyScheduleItem } from "@/types/activity"

export interface ActivityTemplate {
  id: string
  name: string
  event_name: string | null
  daily_schedule: DailyScheduleItem[] | null
  created_by: string
  created_at: string
}

interface UseActivityTemplatesReturn {
  templates: ActivityTemplate[]
  isLoading: boolean
  selectedTemplateId: string
  setSelectedTemplateId: (id: string) => void
  applyTemplate: (template: ActivityTemplate) => void
  deleteTemplate: (id: string) => Promise<void>
  saveTemplate: (name: string, event_name: string, daily_schedule: DailyScheduleItem[]) => Promise<void>
  updateTemplate: (id: string, name: string, event_name: string, daily_schedule: DailyScheduleItem[]) => Promise<void>
  isDeleting: boolean
  isSavingTemplate: boolean
  isUpdatingTemplate: boolean
  templateError: string | null
}

interface UseActivityTemplatesOptions {
  onApply: (event_name: string, daily_schedule: DailyScheduleItem[]) => void
}

export function useActivityTemplates({ onApply }: UseActivityTemplatesOptions): UseActivityTemplatesReturn {
  const [templates, setTemplates] = useState<ActivityTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/activity-templates')
        const result = await response.json()
        if (response.ok && result.success) {
          setTemplates(result.templates ?? [])
        }
      } catch (err) {
        console.error('Failed to fetch activity templates:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const applyTemplate = useCallback((template: ActivityTemplate) => {
    onApply(template.event_name ?? "", template.daily_schedule ?? [])
  }, [onApply])

  const deleteTemplate = useCallback(async (id: string) => {
    setIsDeleting(true)
    setTemplateError(null)
    try {
      const response = await fetch(`/api/activity-templates/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'テンプレートの削除に失敗しました')
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (selectedTemplateId === id) {
        setSelectedTemplateId("")
      }
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'テンプレートの削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }, [selectedTemplateId])

  const saveTemplate = useCallback(async (
    name: string,
    event_name: string,
    daily_schedule: DailyScheduleItem[]
  ) => {
    setIsSavingTemplate(true)
    setTemplateError(null)
    try {
      const response = await fetch('/api/activity-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, event_name: event_name || null, daily_schedule }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'テンプレートの保存に失敗しました')
      }
      setTemplates((prev) => [result.template, ...prev])
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'テンプレートの保存に失敗しました')
      throw err
    } finally {
      setIsSavingTemplate(false)
    }
  }, [])

  const updateTemplate = useCallback(async (
    id: string,
    name: string,
    event_name: string,
    daily_schedule: DailyScheduleItem[]
  ) => {
    setIsUpdatingTemplate(true)
    setTemplateError(null)
    try {
      const response = await fetch(`/api/activity-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, event_name: event_name || null, daily_schedule }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'テンプレートの更新に失敗しました')
      }
      setTemplates((prev) => prev.map((t) => t.id === id ? result.template : t))
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'テンプレートの更新に失敗しました')
      throw err
    } finally {
      setIsUpdatingTemplate(false)
    }
  }, [])

  return {
    templates,
    isLoading,
    selectedTemplateId,
    setSelectedTemplateId,
    applyTemplate,
    deleteTemplate,
    saveTemplate,
    updateTemplate,
    isDeleting,
    isSavingTemplate,
    isUpdatingTemplate,
    templateError,
  }
}
