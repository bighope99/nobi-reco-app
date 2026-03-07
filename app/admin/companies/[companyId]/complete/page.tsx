"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Building2, ArrowRight } from "lucide-react"

interface CompanyCompletePageProps {
  params: Promise<{ companyId: string }>
}

export default function CompanyCompletePage(props: CompanyCompletePageProps) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string>("")
  const [companyName, setCompanyName] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { companyId: id } = await props.params
      setCompanyId(id)

      try {
        const response = await fetch(`/api/admin/companies/${id}`)
        const result = await response.json()
        if (result.success && result.data) {
          setCompanyName(result.data.name || "")
        }
      } catch {
        // 会社名取得失敗は致命的ではない
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [props.params])

  if (loading) {
    return (
      <AdminLayout title="会社登録完了">
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="会社登録完了">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-50 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-xl">会社登録が完了しました</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {companyName && (
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-800">{companyName}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p>会社管理者に招待メールを送信しました。</p>
              <p className="mt-1">管理者はメール内のリンクからパスワードを設定してログインできます。</p>
            </div>

            <div className="border-t pt-6 space-y-3">
              <p className="text-sm font-medium text-slate-700 text-center">
                続けて施設を登録してください
              </p>
              <Button
                className="w-full"
                onClick={() => router.push(`/admin/companies/${companyId}/facilities/new`)}
              >
                <Building2 className="mr-2 h-4 w-4" />
                施設を登録する
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/admin/companies")}
              >
                会社一覧に戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
