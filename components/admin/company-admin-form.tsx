"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

// ========================================
// Type Definitions
// ========================================

export interface Company {
  id: string
  name: string
}

export interface CompanyAdminFormProps {
  companies: Company[]
  onSubmit: (data: {
    company_id: string
    admin_user: { name: string; name_kana: string; email: string }
  }) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

// ========================================
// Validation
// ========================================

interface ValidationErrors {
  companyId?: string
  name?: string
  email?: string
}

function validateForm(
  companyId: string,
  name: string,
  email: string
): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!companyId) {
    errors.companyId = "会社を選択してください"
  }

  if (!name.trim()) {
    errors.name = "管理者氏名は必須です"
  }

  if (!email.trim()) {
    errors.email = "メールアドレスは必須です"
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      errors.email = "メールアドレスの形式が正しくありません"
    }
  }

  return errors
}

// ========================================
// Component
// ========================================

export function CompanyAdminForm({
  companies,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CompanyAdminFormProps) {
  const [companyId, setCompanyId] = useState("")
  const [name, setName] = useState("")
  const [nameKana, setNameKana] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    const errors = validateForm(companyId, name, email)
    const firstError = Object.values(errors)[0]
    if (firstError) {
      setError(firstError)
      return
    }

    try {
      await onSubmit({
        company_id: companyId,
        admin_user: {
          name,
          name_kana: nameKana,
          email,
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました")
    }
  }

  const isDisabled = isSubmitting

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Admin User Section */}
      <Card>
        <CardHeader>
          <CardTitle>管理者情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-select">
              会社選択 <span className="text-red-500">*</span>
            </Label>
            <select
              id="company-select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={isDisabled}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">会社を選択してください</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-name">
              管理者氏名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="admin-name"
              placeholder="例: 山田 太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-name-kana">管理者氏名カナ</Label>
            <Input
              id="admin-name-kana"
              placeholder="例: ヤマダ タロウ"
              value={nameKana}
              onChange={(e) => setNameKana(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">
              メールアドレス <span className="text-red-500">*</span>
            </Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="例: admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isDisabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isDisabled}
        >
          キャンセル
        </Button>
        <Button type="submit" disabled={isDisabled}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              登録中...
            </>
          ) : (
            "登録"
          )}
        </Button>
      </div>
    </form>
  )
}
