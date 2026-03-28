"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useRole } from "@/hooks/useRole"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, ArrowLeft, Pencil, Building2, Users, MapPin, Plus, Mail, UserPlus, Trash2 } from "lucide-react"

interface Facility {
  id: string
  name: string
  address: string | null
  phone: string | null
  capacity: number | null
  is_active: boolean
}

interface AccountFacility {
  facility_id: string
  facility_name: string
  is_primary: boolean
  is_current: boolean
}

interface Account {
  id: string
  name: string
  email: string | null
  role: string
  is_active: boolean
  email_confirmed: boolean
  facilities: AccountFacility[]
}

interface Company {
  id: string
  name: string
  name_kana: string | null
  postal_code: string | null
  address: string | null
  phone: string | null
  is_active: boolean
}

interface CompanyDetailResponse {
  success: boolean
  data?: {
    company: Company
    facilities: Facility[]
    accounts: Account[]
  }
  error?: string
}

export default function CompanyDetailPage(props: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = use(props.params)
  const router = useRouter()
  const { hasRole } = useRole()

  const [company, setCompany] = useState<Company | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  // アカウント追加モーダル
  const [showAddAdminModal, setShowAddAdminModal] = useState(false)
  const [addAdminForm, setAddAdminForm] = useState({ name: "", name_kana: "", email: "", phone: "", role: "company_admin", facility_id: "", hire_year: "", hire_month: "", hire_day: "" })
  const [isAddingAdmin, setIsAddingAdmin] = useState(false)
  const [addAdminError, setAddAdminError] = useState<string | null>(null)

  const fetchCompanyDetail = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/companies/${companyId}`)
      const data: CompanyDetailResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "会社情報の取得に失敗しました")
      }

      if (data.data) {
        setCompany(data.data.company)
        setFacilities(data.data.facilities)
        setAccounts(data.data.accounts)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "会社情報の取得に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanyDetail()
  }, [companyId])

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case "site_admin":
        return "システム管理者"
      case "company_admin":
        return "会社管理者"
      case "facility_admin":
        return "施設管理者"
      case "staff":
        return "職員"
      default:
        return "不明"
    }
  }

  const getRoleBadgeVariant = (role: string): "default" | "secondary" => {
    return role === "company_admin" ? "default" : "secondary"
  }

  const handleResendInvite = async (accountId: string) => {
    setResendingId(accountId)
    setResendMessage(null)
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: accountId }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "再送信に失敗しました")
      }
      setResendMessage("招待メールを再送信しました")
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "再送信に失敗しました")
    } finally {
      setResendingId(null)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('このユーザーを削除しますか？')) return

    setDeletingId(accountId)
    try {
      const response = await fetch(`/api/users/${accountId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'ユーザーの削除に失敗しました')
      }
      await fetchCompanyDetail()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ユーザーの削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingAdmin(true)
    setAddAdminError(null)
    try {
      const response = await fetch("/api/admin/company-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          role: addAdminForm.role,
          facility_id: addAdminForm.facility_id || undefined,
          admin_user: {
            name: addAdminForm.name,
            name_kana: addAdminForm.name_kana || undefined,
            email: addAdminForm.email || undefined,
            phone: addAdminForm.phone || undefined,
            hire_date: addAdminForm.hire_year && addAdminForm.hire_month && addAdminForm.hire_day
              ? `${addAdminForm.hire_year}-${addAdminForm.hire_month.padStart(2, '0')}-${addAdminForm.hire_day.padStart(2, '0')}`
              : undefined,
          },
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "アカウントの追加に失敗しました")
      }
      setShowAddAdminModal(false)
      setAddAdminForm({ name: "", name_kana: "", email: "", phone: "", role: "company_admin", facility_id: "", hire_year: "", hire_month: "", hire_day: "" })
      await fetchCompanyDetail()
    } catch (err) {
      setAddAdminError(err instanceof Error ? err.message : "アカウントの追加に失敗しました")
    } finally {
      setIsAddingAdmin(false)
    }
  }

  const needsFacility = addAdminForm.role === "facility_admin" || addAdminForm.role === "staff"
  const needsEmail = addAdminForm.role !== "staff"

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout title="会社詳細">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">読み込み中...</span>
        </div>
      </AdminLayout>
    )
  }

  // Error state
  if (error || !company) {
    return (
      <AdminLayout title="会社詳細">
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-lg text-destructive">
            {error || "会社が見つかりません"}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => router.push("/admin/companies")}
          >
            会社一覧に戻る
          </Button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="会社詳細" subtitle={company.name}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between gap-4">
          {!hasRole('company_admin') && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <Link href="/admin/companies">
                <ArrowLeft className="h-4 w-4" />
                会社一覧に戻る
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            asChild
            className="gap-2"
          >
            <Link href={`/admin/companies/${companyId}/edit`}>
              <Pencil className="h-4 w-4" />
              編集
            </Link>
          </Button>
        </div>

        {/* Company Information Card */}
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b bg-muted/30 rounded-none">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">会社情報</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="py-6">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <dt className="text-sm font-semibold text-muted-foreground mb-1">会社名</dt>
                <dd className="text-base font-medium">{company.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground mb-1">会社名（カナ）</dt>
                <dd className="text-base font-medium">{company.name_kana || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground mb-1">郵便番号</dt>
                <dd className="text-base font-medium">{company.postal_code || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground mb-1">住所</dt>
                <dd className="text-base font-medium">{company.address || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground mb-1">電話番号</dt>
                <dd className="text-base font-medium">{company.phone || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground mb-1">ステータス</dt>
                <dd>
                  <Badge variant={company.is_active ? "default" : "destructive"}>
                    {company.is_active ? "有効" : "無効"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Accounts List Card */}
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b bg-muted/30 rounded-none">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">アカウント一覧</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto gap-2"
                onClick={() => setShowAddAdminModal(true)}
              >
                <UserPlus className="h-4 w-4" />
                アカウントを追加
              </Button>
              <Badge variant="outline">
                {accounts.length}件
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {resendMessage && (
              <div className="px-6 py-3 text-sm bg-blue-50 border-b border-blue-100 text-blue-700">
                {resendMessage}
              </div>
            )}
            {accounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                登録されたアカウントはありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        氏名
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        メールアドレス
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        権限
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        所属施設
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ステータス
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-slate-900">{account.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600">{account.email || "-"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={getRoleBadgeVariant(account.role)}>
                            {getRoleLabel(account.role)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 min-w-[120px]">
                          <span className="text-sm text-slate-600">
                            {(() => {
                              const sorted = [...account.facilities].sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0))
                              if (sorted.length === 0) return "-"
                              if (sorted.length === 1) return sorted[0].facility_name
                              return `${sorted[0].facility_name}..他${sorted.length - 1}施設`
                            })()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!account.email ? (
                            <Badge variant="secondary">
                              ログインなし
                            </Badge>
                          ) : account.email_confirmed ? (
                            <Badge variant={account.is_active ? "default" : "destructive"}>
                              {account.is_active ? "有効" : "無効"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-amber-700 bg-amber-50 border border-amber-200">
                              招待中
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {account.email && !account.email_confirmed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs"
                                disabled={resendingId === account.id}
                                onClick={() => handleResendInvite(account.id)}
                              >
                                {resendingId === account.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Mail className="h-3 w-3" />
                                )}
                                招待再送
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === account.id}
                              onClick={() => handleDeleteAccount(account.id)}
                            >
                              {deletingId === account.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              削除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facilities List Card */}
        <Card className="overflow-hidden py-0">
          <CardHeader className="border-b bg-muted/30 rounded-none">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">施設一覧</CardTitle>
              <Button size="sm" asChild className="ml-auto gap-2">
                <Link href={`/admin/companies/${companyId}/facilities/new`}>
                  <Plus className="h-4 w-4" />
                  施設を登録
                </Link>
              </Button>
              <Badge variant="outline">
                {facilities.length}件
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {facilities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                登録された施設はありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        施設名
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        住所
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        電話番号
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        定員
                      </th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ステータス
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {facilities.map((facility) => (
                      <tr key={facility.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-slate-900">{facility.name}</span>
                        </td>
                        <td className="px-6 py-4 min-w-[120px]">
                          <span className="text-sm text-slate-600">{facility.address || "-"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600">{facility.phone || "-"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600">
                            {facility.capacity !== null ? `${facility.capacity}名` : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={facility.is_active ? "default" : "destructive"}>
                            {facility.is_active ? "有効" : "無効"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* アカウント追加モーダル */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">アカウントを追加</h2>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              {addAdminError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {addAdminError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="admin-role">権限 <span className="text-destructive">*</span></Label>
                <select
                  id="admin-role"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={addAdminForm.role}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, role: e.target.value, facility_id: "" }))}
                  disabled={isAddingAdmin}
                >
                  <option value="company_admin">会社管理者</option>
                  <option value="facility_admin">施設管理者</option>
                  <option value="staff">職員</option>
                </select>
              </div>
              {needsFacility && (
                <div className="space-y-2">
                  <Label htmlFor="admin-facility">所属施設 <span className="text-destructive">*</span></Label>
                  <select
                    id="admin-facility"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={addAdminForm.facility_id}
                    onChange={(e) => setAddAdminForm((f) => ({ ...f, facility_id: e.target.value }))}
                    required
                    disabled={isAddingAdmin}
                  >
                    <option value="">施設を選択してください</option>
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="admin-name">氏名 <span className="text-destructive">*</span></Label>
                <Input
                  id="admin-name"
                  value={addAdminForm.name}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  disabled={isAddingAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-name-kana">氏名（カナ）</Label>
                <Input
                  id="admin-name-kana"
                  value={addAdminForm.name_kana}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, name_kana: e.target.value }))}
                  disabled={isAddingAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">
                  メールアドレス
                  {needsEmail && <span className="text-destructive"> *</span>}
                  {!needsEmail && <span className="text-muted-foreground text-xs ml-1">（任意）</span>}
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={addAdminForm.email}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, email: e.target.value }))}
                  required={needsEmail}
                  disabled={isAddingAdmin}
                  placeholder={!needsEmail ? "未入力の場合、ログインアカウントなしで登録" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-phone">
                  電話番号
                  <span className="text-muted-foreground text-xs ml-1">（任意）</span>
                </Label>
                <Input
                  id="admin-phone"
                  type="tel"
                  value={addAdminForm.phone}
                  onChange={(e) => setAddAdminForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={isAddingAdmin}
                  placeholder="090-1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label>入社年月日 <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={addAdminForm.hire_year}
                    onChange={(e) => setAddAdminForm((f) => ({ ...f, hire_year: e.target.value }))}
                    disabled={isAddingAdmin}
                  >
                    <option value="">年</option>
                    {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={String(year)}>{year}年</option>
                    ))}
                  </select>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={addAdminForm.hire_month}
                    onChange={(e) => setAddAdminForm((f) => ({ ...f, hire_month: e.target.value }))}
                    disabled={isAddingAdmin}
                  >
                    <option value="">月</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={String(month)}>{month}月</option>
                    ))}
                  </select>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={addAdminForm.hire_day}
                    onChange={(e) => setAddAdminForm((f) => ({ ...f, hire_day: e.target.value }))}
                    disabled={isAddingAdmin}
                  >
                    <option value="">日</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={String(day)}>{day}日</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isAddingAdmin}
                  onClick={() => {
                    setShowAddAdminModal(false)
                    setAddAdminError(null)
                    setAddAdminForm({ name: "", name_kana: "", email: "", phone: "", role: "company_admin", facility_id: "", hire_year: "", hire_month: "", hire_day: "" })
                  }}
                >
                  キャンセル
                </Button>
                <Button type="submit" className="flex-1" disabled={isAddingAdmin || !addAdminForm.hire_year || !addAdminForm.hire_month || !addAdminForm.hire_day}>
                  {isAddingAdmin ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登録中...
                    </>
                  ) : (
                    "追加"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
