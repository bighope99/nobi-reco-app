"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CompanyFormData {
  name: string
  name_kana: string
  postal_code: string
  address: string
  phone: string
  email: string
}

interface FacilityFormData {
  name: string
  name_kana: string
  postal_code: string
  address: string
  phone: string
  capacity: string
}

interface AdminUserFormData {
  name: string
  name_kana: string
  email: string
}

export default function NewCompanyPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [company, setCompany] = useState<CompanyFormData>({
    name: "",
    name_kana: "",
    postal_code: "",
    address: "",
    phone: "",
    email: "",
  })

  const [facility, setFacility] = useState<FacilityFormData>({
    name: "",
    name_kana: "",
    postal_code: "",
    address: "",
    phone: "",
    capacity: "",
  })

  const [adminUser, setAdminUser] = useState<AdminUserFormData>({
    name: "",
    name_kana: "",
    email: "",
  })

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

    // バリデーション
    if (!company.name.trim()) {
      setError("会社名は必須です")
      return
    }
    if (!facility.name.trim()) {
      setError("施設名は必須です")
      return
    }
    if (!adminUser.name.trim()) {
      setError("代表者氏名は必須です")
      return
    }
    if (!adminUser.email.trim()) {
      setError("代表者メールアドレスは必須です")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminUser.email.trim())) {
      setError("メールアドレスの形式が正しくありません")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: {
            name: company.name.trim(),
            name_kana: company.name_kana.trim() || undefined,
            postal_code: company.postal_code.trim() || undefined,
            address: company.address.trim() || undefined,
            phone: company.phone.trim() || undefined,
            email: company.email.trim() || undefined,
          },
          facility: {
            name: facility.name.trim(),
            name_kana: facility.name_kana.trim() || undefined,
            postal_code: facility.postal_code.trim() || undefined,
            address: facility.address.trim() || undefined,
            phone: facility.phone.trim() || undefined,
            capacity: facility.capacity ? parseInt(facility.capacity, 10) : undefined,
          },
          admin_user: {
            name: adminUser.name.trim(),
            name_kana: adminUser.name_kana.trim() || undefined,
            email: adminUser.email.trim(),
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "会社の登録に失敗しました")
      }

      router.push("/admin/companies")
    } catch (err) {
      setError(err instanceof Error ? err.message : "会社の登録に失敗しました")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push("/admin/companies")
  }

  return (
    <AdminLayout title="会社登録" subtitle="新しい会社を登録">
      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* エラーメッセージ */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 会社情報セクション */}
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
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-name-kana">会社名カナ</Label>
                <Input
                  id="company-name-kana"
                  placeholder="例: カブシキガイシャマルマル"
                  value={company.name_kana}
                  onChange={(e) => handleCompanyChange("name_kana", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-postal-code">郵便番号</Label>
                <Input
                  id="company-postal-code"
                  placeholder="例: 100-0001"
                  value={company.postal_code}
                  onChange={(e) => handleCompanyChange("postal_code", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-address">住所</Label>
                <Input
                  id="company-address"
                  placeholder="例: 東京都千代田区..."
                  value={company.address}
                  onChange={(e) => handleCompanyChange("address", e.target.value)}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* 施設情報セクション */}
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
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facility-name-kana">施設名カナ</Label>
                <Input
                  id="facility-name-kana"
                  placeholder="例: マルマルガクドウクラブ"
                  value={facility.name_kana}
                  onChange={(e) => handleFacilityChange("name_kana", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facility-postal-code">郵便番号</Label>
                <Input
                  id="facility-postal-code"
                  placeholder="例: 100-0001"
                  value={facility.postal_code}
                  onChange={(e) => handleFacilityChange("postal_code", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facility-address">住所</Label>
                <Input
                  id="facility-address"
                  placeholder="例: 東京都千代田区..."
                  value={facility.address}
                  onChange={(e) => handleFacilityChange("address", e.target.value)}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* 代表者情報セクション */}
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
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-name-kana">代表者氏名カナ</Label>
                <Input
                  id="admin-name-kana"
                  placeholder="例: ヤマダ タロウ"
                  value={adminUser.name_kana}
                  onChange={(e) => handleAdminUserChange("name_kana", e.target.value)}
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
          </Card>

          {/* ボタン */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
