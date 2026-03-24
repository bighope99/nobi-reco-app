"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react"

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
  sort_order: number
  is_active: boolean
}

const defaultFormState: TagFormState = {
  name: "",
  name_en: "",
  description: "",
  color: "#4CAF50",
  sort_order: 0,
  is_active: true,
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 追加/編集 Dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [formState, setFormState] = useState<TagFormState>(defaultFormState)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // 削除確認 Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [usageCount, setUsageCount] = useState<number | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
      color: tag.color ?? "#4CAF50",
      sort_order: tag.sort_order,
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
        sort_order: formState.sort_order,
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
          <CardContent>
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
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="h-5 w-5 flex-shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: tag.color ?? "#e5e7eb" }}
                      />
                      <div className="min-w-0">
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
                          <p className="mt-0.5 text-sm text-muted-foreground truncate">
                            {tag.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          表示順: {tag.sort_order}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(tag)}
                        aria-label={`${tag.name}を編集`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(tag)}
                        aria-label={`${tag.name}を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
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

            <div className="space-y-1">
              <Label htmlFor="tag-color">表示色</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="tag-color"
                  value={formState.color}
                  onChange={(e) => setFormState((s) => ({ ...s, color: e.target.value }))}
                  className="h-9 w-16 cursor-pointer rounded border border-input"
                />
                <span className="text-sm text-muted-foreground">{formState.color}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tag-sort-order">表示順</Label>
              <Input
                id="tag-sort-order"
                type="number"
                value={formState.sort_order}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, sort_order: parseInt(e.target.value, 10) || 0 }))
                }
              />
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
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
