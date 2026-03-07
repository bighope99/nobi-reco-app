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

export interface FacilityRegistrationData {
  facility: {
    name: string
    name_kana: string
    postal_code: string
    address: string
    phone: string
    capacity: string
  }
  facilityAdmin: {
    name: string
    name_kana: string
    email: string
  }
}

export interface FacilityRegistrationFormProps {
  onSubmit: (data: FacilityRegistrationData) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

// ========================================
// Component
// ========================================

export function FacilityRegistrationForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: FacilityRegistrationFormProps) {
  const [facilityName, setFacilityName] = useState("")
  const [facilityNameKana, setFacilityNameKana] = useState("")
  const [facilityPostalCode, setFacilityPostalCode] = useState("")
  const [facilityAddress, setFacilityAddress] = useState("")
  const [facilityPhone, setFacilityPhone] = useState("")
  const [facilityCapacity, setFacilityCapacity] = useState("")

  const [adminName, setAdminName] = useState("")
  const [adminNameKana, setAdminNameKana] = useState("")
  const [adminEmail, setAdminEmail] = useState("")

  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!facilityName.trim()) {
      setError("施設名は必須です")
      return
    }
    if (!adminName.trim()) {
      setError("施設管理者氏名は必須です")
      return
    }
    if (!adminEmail.trim()) {
      setError("施設管理者メールアドレスは必須です")
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(adminEmail.trim())) {
      setError("メールアドレスの形式が正しくありません")
      return
    }
    const parsedCapacity = facilityCapacity.trim()
      ? parseInt(facilityCapacity.trim(), 10)
      : null
    if (parsedCapacity !== null && (isNaN(parsedCapacity) || parsedCapacity <= 0)) {
      setError("定員は1以上の整数を入力してください")
      return
    }

    try {
      await onSubmit({
        facility: {
          name: facilityName,
          name_kana: facilityNameKana,
          postal_code: facilityPostalCode,
          address: facilityAddress,
          phone: facilityPhone,
          capacity: facilityCapacity,
        },
        facilityAdmin: {
          name: adminName,
          name_kana: adminNameKana,
          email: adminEmail,
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

      {/* Facility Section */}
      <Card>
        <CardHeader>
          <CardTitle>施設情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="facility-name">
              施設名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="facility-name"
              placeholder="例: 〇〇学童クラブ"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facility-name-kana">施設名カナ</Label>
            <Input
              id="facility-name-kana"
              placeholder="例: マルマルガクドウクラブ"
              value={facilityNameKana}
              onChange={(e) => setFacilityNameKana(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facility-postal-code">郵便番号</Label>
            <Input
              id="facility-postal-code"
              placeholder="例: 100-0001"
              value={facilityPostalCode}
              onChange={(e) => setFacilityPostalCode(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facility-address">住所</Label>
            <Input
              id="facility-address"
              placeholder="例: 東京都千代田区..."
              value={facilityAddress}
              onChange={(e) => setFacilityAddress(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facility-phone">電話番号</Label>
            <Input
              id="facility-phone"
              type="tel"
              placeholder="例: 03-1234-5678"
              value={facilityPhone}
              onChange={(e) => setFacilityPhone(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="facility-capacity">定員</Label>
            <Input
              id="facility-capacity"
              type="number"
              placeholder="例: 40"
              value={facilityCapacity}
              onChange={(e) => setFacilityCapacity(e.target.value)}
              disabled={isDisabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Facility Admin Section */}
      <Card>
        <CardHeader>
          <CardTitle>施設管理者情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fadmin-name">
              管理者氏名 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fadmin-name"
              placeholder="例: 山田 太郎"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fadmin-name-kana">管理者氏名カナ</Label>
            <Input
              id="fadmin-name-kana"
              placeholder="例: ヤマダ タロウ"
              value={adminNameKana}
              onChange={(e) => setAdminNameKana(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fadmin-email">
              メールアドレス <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fadmin-email"
              type="email"
              placeholder="例: admin@example.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            施設管理者に招待メールが送信されます。メール内のリンクからパスワードを設定してログインできます。
          </p>
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
            "施設を登録"
          )}
        </Button>
      </div>
    </form>
  )
}
