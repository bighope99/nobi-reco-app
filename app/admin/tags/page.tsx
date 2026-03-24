"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Loader2, AlertCircle, GripVertical } from "lucide-react"

const COLOR_PALETTE = [
  { value: "#EF4444", label: "赤" },
  { value: "#F59E0B", label: "黄" },
  { value: "#22C55E", label: "緑" },
  { value: "#3B82F6", label: "青" },
  { value: "#8B5CF6", label: "紫" },
]

const DEFAULT_COLOR = COLOR_PALETTE[3].value // 青

interface Tag {
  id: string
  name: string
  name_en: string | null
  description: string | null
  color: string | null
  sort_order: number
  is_active: boolean
}

interface TagFormState {
  name: string
  name_en: string
  description: string
  color: string
  is_active: boolean
}

const defaultFormState: TagFormState = {
  name: "",
  name_en: "",
  description: "",
  color: DEFAULT_COLOR,
  is_active: true,
}

function SortableRow({
  tag,
  onEdit,
  onDelete,
}: {
  tag: Tag
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50"
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="並び替え"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div
        className="h-4 w-4 flex-shrink-0 rounded-full border border-border"
        style={{ backgroundColor: tag.color ?? "#e5e7eb" }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{tag.name}</span>
          {tag.name_en && (
            <span className="text-sm text-muted-foreground">({tag.name_en})</span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              tag.is_active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {tag.is_active ? "有効" : "無効"}
          </span>
        </div>
        {tag.description && (
          <p className="mt-0.5 text-sm text-muted-foreground truncate">{tag.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(tag)}
          aria-label={`${tag.name}を編集`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(tag)}
          aria-label={`${tag.name}を削除`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [formState, setFormState] = useState<TagFormState>(defaultFormState)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [usageCount, setUsageCount] = useState<number | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor))

  const fetchTags = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/admin/tags")
      const data = await response.json()
      if (data.success) {
        setTags(data.data.tags)
      } else {
        setError(data.error || "タグ一覧の取得に失敗しました")
      }
    } catch {
      setError("タグ一覧の取得に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tags.findIndex((t) => t.id === active.id)
    const newIndex = tags.findIndex((t) => t.id === over.id)
    const prevTags = tags
    const reordered = arrayMove(tags, oldIndex, newIndex)

    setTags(reordered)

    // sort_orderが変化したタグのみ更新
    const updates = reordered
      .map((tag, index) => ({ ...tag, newSortOrder: index + 1 }))
      .filter((t) => t.sort_order !== t.newSortOrder)

    try {
      await Promise.all(
        updates.map((t) =>
          fetch(`/api/admin/tags/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sort_order: t.newSortOrder }),
          }).then((res) => {
            if (!res.ok) throw new Error(`Failed to update tag ${t.id}`)
          })
        )
      )
    } catch {
      setError("並び替えの保存に失敗しました")
      setTags(prevTags)
    }
  }

  const openAddDialog = () => {
    setEditingTag(null)
    setFormState(defaultFormState)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag)
    setFormState({
      name: tag.name,
      name_en: tag.name_en ?? "",
      description: tag.description ?? "",
      color: tag.color ?? DEFAULT_COLOR,
      is_active: tag.is_active,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formState.name.trim()) {
      setFormError("タグ名は必須です")
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      const payload = {
        name: formState.name.trim(),
        name_en: formState.name_en.trim() || null,
        description: formState.description.trim() || null,
        color: formState.color || null,
        is_active: formState.is_active,
      }

      const response = editingTag
        ? await fetch(`/api/admin/tags/${editingTag.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      const data = await response.json()
      if (data.success) {
        setDialogOpen(false)
        await fetchTags()
      } else {
        setFormError(data.error || "保存に失敗しました")
      }
    } catch {
      setFormError("保存に失敗しました")
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteDialog = async (tag: Tag) => {
    setDeletingTag(tag)
    setUsageCount(null)
    setDeleteDialogOpen(true)

    setIsLoadingUsage(true)
    try {
      const response = await fetch(`/api/admin/tags/${tag.id}`)
      const data = await response.json()
      if (data.success) {
        setUsageCount(data.data.usage_count)
      }
    } catch {
      // 使用件数取得失敗時も削除は続行可能
    } finally {
      setIsLoadingUsage(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTag) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/tags/${deletingTag.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (data.success) {
        setDeleteDialogOpen(false)
        await fetchTags()
      } else {
        alert(data.error || "削除に失敗しました")
      }
    } catch {
      alert("削除に失敗しました")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AdminLayout title="観点タグ管理">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            タグを追加
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>タグ一覧</span>
              {!isLoading && !error && (
                <span className="text-sm font-normal text-muted-foreground">
                  {tags.length}件
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">読み込み中...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
                <Button variant="outline" size="sm" className="ml-4" onClick={fetchTags}>
                  再試行
                </Button>
              </div>
            ) : tags.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                登録されたタグがありません
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={tags.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tags.map((tag) => (
                    <SortableRow
                      key={tag.id}
                      tag={tag}
                      onEdit={openEditDialog}
                      onDelete={openDeleteDialog}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 追加/編集 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? "タグを編集" : "タグを追加"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {formError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="tag-name">タグ名 *</Label>
              <Input
                id="tag-name"
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                placeholder="例: 自立"
                maxLength={50}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tag-name-en">英語名</Label>
              <Input
                id="tag-name-en"
                value={formState.name_en}
                onChange={(e) => setFormState((s) => ({ ...s, name_en: e.target.value }))}
                placeholder="例: Independence"
                maxLength={50}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tag-description">説明</Label>
              <Textarea
                id="tag-description"
                value={formState.description}
                onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                placeholder="このタグの説明を入力してください"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>表示色</Label>
              <div className="flex items-center gap-3">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormState((s) => ({ ...s, color: c.value }))}
                    aria-label={c.label}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      formState.color === c.value
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="tag-is-active"
                checked={formState.is_active}
                onChange={(e) => setFormState((s) => ({ ...s, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="tag-is-active">有効</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>タグを削除しますか？</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deletingTag?.name}</span>{" "}
              を削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {isLoadingUsage ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                使用件数を確認中...
              </div>
            ) : usageCount !== null && usageCount > 0 ? (
              <div className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                このタグは現在{" "}
                <span className="font-semibold">{usageCount}件</span>{" "}
                の観察記録で使用されています。
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
