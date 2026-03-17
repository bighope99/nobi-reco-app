"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Building2, ArrowRight } from "lucide-react"
import {
  FacilityRegistrationForm,
  type FacilityRegistrationData,
} from "@/components/admin/facility-registration-form"

interface FacilityNewPageProps {
  params: Promise<{ companyId: string }>
}

export default function FacilityNewPage(props: FacilityNewPageProps) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string>("")
  const [companyName, setCompanyName] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  // 完了状態
  const [completed, setCompleted] = useState(false)
  const [createdFacilityName, setCreatedFacilityName] = useState("")

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

  const handleSubmit = async (data: FacilityRegistrationData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/admin/companies/${companyId}/facilities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facility: {
            name: data.facility.name.trim(),
            name_kana: data.facility.name_kana.trim() || undefined,
            postal_code: data.facility.postal_code.trim() || undefined,
            address: data.facility.address.trim() || undefined,
            phone: data.facility.phone.trim() || undefined,
            capacity: data.facility.capacity.trim() || undefined,
          },
          facility_admin: {
            name: data.facilityAdmin.name.trim(),
            name_kana: data.facilityAdmin.name_kana.trim() || undefined,
            email: data.facilityAdmin.email.trim(),
          },
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "施設の登録に失敗しました")
      }

      setCreatedFacilityName(result.data.facility_name)
      setCompleted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push(`/admin/companies`)
  }

  if (loading) {
    return (
      <AdminLayout title="施設登録">
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    )
  }

  // 完了画面
  if (completed) {
    return (
      <AdminLayout title="施設登録完了">
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-50 rounded-full">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-xl">施設登録が完了しました</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {createdFacilityName && (
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-800">{createdFacilityName}</p>
                  {companyName && (
                    <p className="text-sm text-slate-500 mt-1">{companyName}</p>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p>施設管理者に招待メールを送信しました。</p>
                <p className="mt-1">管理者はメール内のリンクからパスワードを設定してログインできます。</p>
              </div>

              <div className="border-t pt-6 space-y-3">
                <Button
                  className="w-full"
                  onClick={() => {
                    setCompleted(false)
                    setCreatedFacilityName("")
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  別の施設を登録する
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

  // 登録フォーム
  return (
    <AdminLayout
      title="施設登録"
      subtitle={companyName ? `${companyName} の施設を登録` : "新しい施設を登録"}
    >
      <div className="mx-auto max-w-2xl">
        <FacilityRegistrationForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    </AdminLayout>
  )
}
