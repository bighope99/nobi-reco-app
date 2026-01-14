"use client"

import { useState, useEffect, useCallback } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search, Plus, Edit, Mail, Loader2, AlertCircle } from "lucide-react"

interface AdminUser {
  id: string
  name: string
  email: string
}

interface Company {
  id: string
  name: string
  facilities_count: number
  admin_user: AdminUser | null
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchCompanies = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/admin/companies")
      const data = await response.json()
      if (data.success) {
        setCompanies(data.data.companies)
      } else {
        setError(data.error || "会社一覧の取得に失敗しました")
      }
    } catch {
      setError("会社一覧の取得に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const handleResendInvite = async (companyId: string) => {
    setResendingId(companyId)
    try {
      const response = await fetch(`/api/admin/companies/${companyId}/resend-invite`, {
        method: "POST"
      })
      const data = await response.json()
      if (data.success) {
        alert("招待メールを再送信しました")
      } else {
        alert(data.error || "再送信に失敗しました")
      }
    } catch {
      alert("再送信に失敗しました")
    } finally {
      setResendingId(null)
    }
  }

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AdminLayout title="会社一覧" subtitle="登録会社の管理">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="会社名で検索..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild>
            <Link href="/admin/companies/new">
              <Plus className="mr-2 h-4 w-4" />
              会社を追加
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>会社一覧</CardTitle>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={fetchCompanies}
                >
                  再試行
                </Button>
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                {searchQuery ? "検索結果がありません" : "登録された会社がありません"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{company.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>施設数: {company.facilities_count}</span>
                        {company.admin_user && (
                          <>
                            <span className="hidden sm:inline">|</span>
                            <span>
                              代表者: {company.admin_user.name} ({company.admin_user.email})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {company.admin_user && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvite(company.id)}
                          disabled={resendingId === company.id}
                        >
                          {resendingId === company.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="mr-2 h-4 w-4" />
                          )}
                          {resendingId === company.id ? "送信中..." : "招待再送信"}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" asChild aria-label={`${company.name}を編集`}>
                        <Link href={`/admin/companies/${company.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
