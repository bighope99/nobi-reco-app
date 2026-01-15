"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

// ========================================
// Type Definitions
// ========================================

export interface CompanyFormData {
  name: string
  name_kana: string
  postal_code: string
  address: string
  phone: string
  email: string
}

export interface FacilityFormData {
  name: string
  name_kana: string
  postal_code: string
  address: string
  phone: string
  capacity: string
}

export interface AdminUserFormData {
  name: string
  name_kana: string
  email: string
}

export interface CompanyFormSubmitData {
  company: CompanyFormData
  facility?: FacilityFormData
  adminUser?: AdminUserFormData
}

export interface CompanyFormProps {
  mode: "create" | "edit"
  initialData?: {
    company: CompanyFormData
    facility?: FacilityFormData
    adminUser?: AdminUserFormData
  }
  onSubmit: (data: CompanyFormSubmitData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

// ========================================
// Default Values
// ========================================

const defaultCompanyData: CompanyFormData = {
  name: "",
  name_kana: "",
  postal_code: "",
  address: "",
  phone: "",
  email: "",
}

const defaultFacilityData: FacilityFormData = {
  name: "",
  name_kana: "",
  postal_code: "",
  address: "",
  phone: "",
  capacity: "",
}

const defaultAdminUserData: AdminUserFormData = {
  name: "",
  name_kana: "",
  email: "",
}

// ========================================
// Validation
// ========================================

interface ValidationErrors {
  companyName?: string
  facilityName?: string
  adminUserName?: string
  adminUserEmail?: string
}

function validateForm(
  mode: "create" | "edit",
  company: CompanyFormData,
  facility: FacilityFormData,
  adminUser: AdminUserFormData
): ValidationErrors {
  const errors: ValidationErrors = {}

  // Company name is always required
  if (!company.name.trim()) {
    errors.companyName = "会社名は必須です"
  }

  // Facility and admin user are required only for create mode
  if (mode === "create") {
    if (!facility.name.trim()) {
      errors.facilityName = "施設名は必須です"
    }
    if (!adminUser.name.trim()) {
      errors.adminUserName = "代表者氏名は必須です"
    }
    if (!adminUser.email.trim()) {
      errors.adminUserEmail = "代表者メールアドレスは必須です"
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(adminUser.email.trim())) {
        errors.adminUserEmail = "メールアドレスの形式が正しくありません"
      }
    }
  }

  return errors
}

// ========================================
// Component
// ========================================

export function CompanyForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CompanyFormProps) {
  const [company, setCompany] = useState<CompanyFormData>(
    initialData?.company ?? defaultCompanyData
  )
  const [facility, setFacility] = useState<FacilityFormData>(
    initialData?.facility ?? defaultFacilityData
  )
  const [adminUser, setAdminUser] = useState<AdminUserFormData>(
    initialData?.adminUser ?? defaultAdminUserData
  )
  const [error, setError] = useState<string | null>(null)

  // Sync state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData?.company) {
      setCompany(initialData.company)
    }
    if (initialData?.facility) {
      setFacility(initialData.facility)
    }
    if (initialData?.adminUser) {
      setAdminUser(initialData.adminUser)
    }
  }, [initialData])

  const handleCompanyChange = (field: keyof CompanyFormData, value: string) => {
    setCompany((prev) => ({ ...prev, [field]: value }))
  }

  const handleFacilityChange = (field: keyof FacilityFormData, value: string) => {
    setFacility((prev) => ({ ...prev, [field]: value }))
  }

  const handleAdminUserChange = (field: keyof AdminUserFormData, value: string) => {
    setAdminUser((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    const errors = validateForm(mode, company, facility, adminUser)
    const firstError = Object.values(errors)[0]
    if (firstError) {
      setError(firstError)
      return
    }

    try {
      const submitData: CompanyFormSubmitData = {
        company,
        ...(mode === "create" && { facility, adminUser }),
      }
      await onSubmit(submitData)
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

      {/* Company Section */}
      <Card>
        <CardHeader>
          <CardTitle>会社情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">
              会社名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="company-name"
              placeholder="例: 株式会社〇〇"
              value={company.name}
              onChange={(e) => handleCompanyChange("name", e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-name-kana">会社名カナ</Label>
            <Input
              id="company-name-kana"
              placeholder="例: カブシキガイシャマルマル"
              value={company.name_kana}
              onChange={(e) => handleCompanyChange("name_kana", e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-postal-code">郵便番号</Label>
            <Input
              id="company-postal-code"
              placeholder="例: 100-0001"
              value={company.postal_code}
              onChange={(e) => handleCompanyChange("postal_code", e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-address">住所</Label>
            <Input
              id="company-address"
              placeholder="例: 東京都千代田区..."
              value={company.address}
              onChange={(e) => handleCompanyChange("address", e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-phone">電話番号</Label>
            <Input
              id="company-phone"
              type="tel"
              placeholder="例: 03-1234-5678"
              value={company.phone}
              onChange={(e) => handleCompanyChange("phone", e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email">メールアドレス</Label>
            <Input
              id="company-email"
              type="email"
              placeholder="例: info@example.com"
              value={company.email}
              onChange={(e) => handleCompanyChange("email", e.target.value)}
              disabled={isDisabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Facility Section (Create mode only) */}
      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>初期施設情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facility-name">
                施設名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="facility-name"
                placeholder="例: 〇〇学童クラブ"
                value={facility.name}
                onChange={(e) => handleFacilityChange("name", e.target.value)}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-name-kana">施設名カナ</Label>
              <Input
                id="facility-name-kana"
                placeholder="例: マルマルガクドウクラブ"
                value={facility.name_kana}
                onChange={(e) => handleFacilityChange("name_kana", e.target.value)}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-postal-code">郵便番号</Label>
              <Input
                id="facility-postal-code"
                placeholder="例: 100-0001"
                value={facility.postal_code}
                onChange={(e) => handleFacilityChange("postal_code", e.target.value)}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-address">住所</Label>
              <Input
                id="facility-address"
                placeholder="例: 東京都千代田区..."
                value={facility.address}
                onChange={(e) => handleFacilityChange("address", e.target.value)}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-phone">電話番号</Label>
              <Input
                id="facility-phone"
                type="tel"
                placeholder="例: 03-1234-5678"
                value={facility.phone}
                onChange={(e) => handleFacilityChange("phone", e.target.value)}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility-capacity">定員</Label>
              <Input
                id="facility-capacity"
                type="number"
                min="0"
                placeholder="例: 40"
                value={facility.capacity}
                onChange={(e) => handleFacilityChange("capacity", e.target.value)}
                disabled={isDisabled}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin User Section (Create mode only) */}
      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>代表者情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">
                代表者氏名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admin-name"
                placeholder="例: 山田 太郎"
                value={adminUser.name}
                onChange={(e) => handleAdminUserChange("name", e.target.value)}
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-name-kana">代表者氏名カナ</Label>
              <Input
                id="admin-name-kana"
                placeholder="例: ヤマダ タロウ"
                value={adminUser.name_kana}
                onChange={(e) => handleAdminUserChange("name_kana", e.target.value)}
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
                value={adminUser.email}
                onChange={(e) => handleAdminUserChange("email", e.target.value)}
                disabled={isDisabled}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit mode note */}
      {mode === "edit" && (
        <p className="text-sm text-muted-foreground">
          ※ 施設・代表者情報は別画面で管理されます
        </p>
      )}

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
              保存中...
            </>
          ) : (
            "保存"
          )}
        </Button>
      </div>
    </form>
  )
}
