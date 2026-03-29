"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Clipboard, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TodoItem } from "@/types/activity"

interface HandoverItem {
  activity_id: string
  activity_date?: string
  handover: string | null
  handover_completed: boolean
  class_name: string
  created_by_name: string
  todo_items?: TodoItem[] | null
}

interface PreviousHandoverBannerProps {
  activityDate: string
  selectedClass: string
}

export function PreviousHandoverBanner({ activityDate, selectedClass }: PreviousHandoverBannerProps) {
  const [handoverDate, setHandoverDate] = useState<string | null>(null)
  const [hasNextRecord, setHasNextRecord] = useState(false)
  const [items, setItems] = useState<HandoverItem[]>([])
  const [olderItems, setOlderItems] = useState<HandoverItem[]>([])
  const [loading, setLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [pendingTodoIds, setPendingTodoIds] = useState<Set<string>>(new Set())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!activityDate) {
      setHandoverDate(null)
      setItems([])
      setOlderItems([])
      setHasNextRecord(false)
      return
    }

    // Clear previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    const abortController = new AbortController()

    // Set debounced timer (300ms)
    timerRef.current = setTimeout(() => {
      const fetchHandover = async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams({ date: activityDate })
          if (selectedClass) params.set("class_id", selectedClass)

          const response = await fetch(`/api/handover?${params}`, {
            signal: abortController.signal,
          })
          const result = await response.json()

          if (response.ok && result.success && result.data) {
            setHandoverDate(result.data.handover_date)
            setHasNextRecord(result.data.has_next_record ?? false)
            setItems(result.data.items || [])
            setOlderItems(result.data.older_items || [])
          } else {
            setHandoverDate(null)
            setHasNextRecord(false)
            setItems([])
            setOlderItems([])
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          console.error('Failed to fetch handover:', error)
          setHandoverDate(null)
          setHasNextRecord(false)
          setItems([])
          setOlderItems([])
        } finally {
          if (!abortController.signal.aborted) {
            setLoading(false)
          }
        }
      }

      fetchHandover()
    }, 300)

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      abortController.abort()
    }
  }, [activityDate, selectedClass])

  const toggleTodoItem = useCallback(async (activityId: string, todoItemId: string, completed: boolean) => {
    if (pendingTodoIds.has(todoItemId)) return

    setPendingTodoIds(prev => new Set(prev).add(todoItemId))

    // オプティミスティック更新（items と olderItems 両方を更新）
    const optimisticUpdate = (list: HandoverItem[]) =>
      list.map(item =>
        item.activity_id === activityId
          ? {
              ...item,
              todo_items: (item.todo_items ?? []).map(t =>
                t.id === todoItemId ? { ...t, completed } : t
              ),
            }
          : item
      )
    setItems(optimisticUpdate)
    setOlderItems(optimisticUpdate)

    try {
      const res = await fetch(`/api/handover/${activityId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed, todo_item_id: todoItemId }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
    } catch (err) {
      console.error('ToDo更新エラー:', err)
      // ロールバック
      const rollback = (list: HandoverItem[]) =>
        list.map(item =>
          item.activity_id === activityId
            ? {
                ...item,
                todo_items: (item.todo_items ?? []).map(t =>
                  t.id === todoItemId ? { ...t, completed: !completed } : t
                ),
              }
            : item
        )
      setItems(rollback)
      setOlderItems(rollback)
      window.alert('ToDoの更新に失敗しました。もう一度試してください。')
    } finally {
      setPendingTodoIds(prev => {
        const next = new Set(prev)
        next.delete(todoItemId)
        return next
      })
    }
  }, [pendingTodoIds])

  const handleToggleComplete = useCallback(async (activityId: string, currentCompleted: boolean) => {
    setTogglingId(activityId)
    try {
      const response = await fetch(`/api/handover/${activityId}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentCompleted }),
      })
      const result = await response.json()

      if (response.ok && result.success) {
        setItems((prev) =>
          prev.map((item) =>
            item.activity_id === activityId
              ? { ...item, handover_completed: !currentCompleted }
              : item
          )
        )
      }
    } catch (error) {
      console.error('Failed to toggle handover completion:', error)
    } finally {
      setTogglingId(null)
    }
  }, [])

  // データなし＋ロード完了 → 非表示
  if (items.length === 0 && olderItems.length === 0 && !loading) return null

  // すべて完了済み＋次の記録あり＋過去の未完了なし → 非表示
  const allCompleted = items.length > 0 && items.every((item) => {
    const hasHandover = item.handover && item.handover.trim() !== ''
    if (!hasHandover) {
      const todos = item.todo_items ?? []
      return todos.length === 0 || todos.every(t => t.completed)
    }
    return item.handover_completed
  }) && olderItems.length === 0
  if (allCompleted && hasNextRecord && !loading) return null

  // ローディング中はスケルトン表示
  if (loading) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-orange-100 border-b border-orange-200">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-orange-200 animate-pulse" />
            <div className="h-4 w-20 rounded bg-orange-200 animate-pulse" />
          </div>
          <div className="h-4 w-24 rounded bg-orange-200 animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          <div className="h-4 w-3/4 rounded bg-orange-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-orange-100 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 shadow-md overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-100 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <Clipboard className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <span className="text-sm font-bold text-orange-800">前回の引継ぎ</span>
        </div>
        <span className="text-xs font-medium text-orange-600">{handoverDate}</span>
      </div>
      {/* 引継ぎ内容 */}
      <div className="divide-y divide-orange-200">
        {items.map((item) => (
          <div key={item.activity_id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-600 mb-1">
                  {item.class_name}
                </p>
                <p
                  className={`text-sm whitespace-pre-wrap ${
                    item.handover_completed
                      ? "text-orange-400 line-through"
                      : "text-orange-900"
                  }`}
                >
                  {item.handover}
                </p>
                {item.todo_items && item.todo_items.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-500">次回やることリスト</p>
                    {item.todo_items.map(todo => (
                      <div key={todo.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={e => toggleTodoItem(item.activity_id, todo.id, e.target.checked)}
                          disabled={pendingTodoIds.has(todo.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={todo.content}
                        />
                        <span className={`text-sm ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {todo.content}
                          {handoverDate && (
                            <span className="ml-2 text-xs text-gray-400">[{handoverDate}]</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {item.handover && item.handover.trim() !== '' && (
                <Button
                  type="button"
                  size="sm"
                  variant={item.handover_completed ? "ghost" : "outline"}
                  className={`flex-shrink-0 h-8 ${
                    item.handover_completed
                      ? "text-green-600 hover:text-green-700"
                      : "text-orange-700 hover:text-orange-800 border-orange-300"
                  }`}
                  onClick={() => handleToggleComplete(item.activity_id, item.handover_completed)}
                  disabled={togglingId === item.activity_id}
                >
                  {togglingId === item.activity_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : item.handover_completed ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      完了済み
                    </>
                  ) : (
                    "完了"
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
        {olderItems.map((item) => (
          <div key={item.activity_id} className="px-4 py-3">
            <p className="text-xs font-semibold text-orange-600 mb-1">
              {item.class_name}
            </p>
            {item.todo_items && item.todo_items.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-500">明日やることリスト</p>
                {item.todo_items.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={e => toggleTodoItem(item.activity_id, todo.id, e.target.checked)}
                      disabled={pendingTodoIds.has(todo.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={todo.content}
                    />
                    <span className={`text-sm ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {todo.content}
                      {item.activity_date && (
                        <span className="ml-2 text-xs text-gray-400">[{item.activity_date}]</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
