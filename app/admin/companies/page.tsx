"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search, Plus, Edit, Building2, AlertCircle } from "lucide-react"

interface Company {
  id: string
  name: string
  name_kana: string | null
  postal_code: string | null
  address: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  facilities_count: number
  created_at: string
  updated_at: string
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 会社一覧を取得
  const fetchCompanies = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/admin/companies")
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "会社一覧の取得に失敗しました")
      }

      setCompanies(data.data.companies)
    } catch (err) {
      console.error("Error fetching companies:", err)
      setError(err instanceof Error ? err.message : "予期しないエラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  // 初期ロード
  useEffect(() => {
    fetchCompanies()
  }, [])

  // クライアントサイドフィルタリング
  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // スケルトンローディング表示
  const renderSkeleton = () => (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border p-4 animate-pulse"
        >
          <div className="space-y-2">
            <div className="h-5 w-48 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
          <div className="h-8 w-8 bg-muted rounded" />
        </div>
      ))}
    </div>
  )

  // エラー表示
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <p className="text-destructive font-medium mb-2">エラーが発生しました</p>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Button variant="outline" onClick={fetchCompanies}>
        再試行
      </Button>
    </div>
  )

  // 空状態表示
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-2">
        {searchTerm ? "該当する会社が見つかりません" : "登録されている会社がありません"}
      </p>
      {searchTerm && (
        <Button variant="ghost" onClick={() => setSearchTerm("")}>
          検索をクリア
        </Button>
      )}
    </div>
  )

  // 会社一覧表示
  const renderCompanies = () => (
    <div className="space-y-2">
      {filteredCompanies.map((company) => (
        <div
          key={company.id}
          className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
        >
          <div>
            <p className="font-medium">{company.name}</p>
            <p className="text-sm text-muted-foreground">
              施設数: {company.facilities_count}
            </p>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/companies/${company.id}/edit`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ))}
    </div>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
            <CardTitle className="flex items-center justify-between">
              <span>会社一覧</span>
              {!loading && !error && (
                <span className="text-sm font-normal text-muted-foreground">
                  {filteredCompanies.length}件
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && renderSkeleton()}
            {!loading && error && renderError()}
            {!loading && !error && filteredCompanies.length === 0 && renderEmpty()}
            {!loading && !error && filteredCompanies.length > 0 && renderCompanies()}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
