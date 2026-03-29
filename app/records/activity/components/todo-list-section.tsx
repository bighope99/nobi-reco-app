'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { TodoItem } from '@/types/activity'

interface TodoListSectionProps {
  items: TodoItem[]
  onChange: (items: TodoItem[]) => void
  disabled?: boolean
}

export function TodoListSection({ items, onChange, disabled }: TodoListSectionProps) {
  const baseId = useId()

  const addItem = () => {
    if (items.length >= 20) return
    const newItem: TodoItem = {
      id: crypto.randomUUID(),
      content: '',
      completed: false,
    }
    onChange([...items, newItem])
  }

  const updateContent = (id: string, content: string) => {
    onChange(items.map(item => item.id === id ? { ...item, content } : item))
  }

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          次回やることリスト
        </label>
        <span className="text-xs text-gray-400">{items.length}/20</span>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-4 shrink-0">{index + 1}</span>
            <input
              id={`${baseId}-item-${item.id}`}
              type="text"
              value={item.content}
              onChange={e => updateContent(item.id, e.target.value)}
              placeholder="やることを入力..."
              maxLength={200}
              disabled={disabled}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              disabled={disabled}
              className="text-gray-400 hover:text-red-500 disabled:opacity-40 p-1 rounded"
              aria-label="削除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {items.length < 20 && (
        <button
          type="button"
          onClick={addItem}
          disabled={disabled}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          追加
        </button>
      )}

      {items.length === 0 && (
        <p className="text-xs text-gray-400">やることを追加してください</p>
      )}
    </div>
  )
}
