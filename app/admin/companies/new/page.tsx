"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import {
  CompanyForm,
  type CompanyFormSubmitData,
} from "@/components/admin/company-form"

export default function NewCompanyPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: CompanyFormSubmitData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: {
            name: data.company.name.trim(),
            name_kana: data.company.name_kana.trim() || undefined,
            postal_code: data.company.postal_code.trim() || undefined,
            address: data.company.address.trim() || undefined,
            phone: data.company.phone.trim() || undefined,
          },
          admin_user: data.adminUser
            ? {
                name: data.adminUser.name.trim(),
                name_kana: data.adminUser.name_kana.trim() || undefined,
                email: data.adminUser.email.trim(),
              }
            : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "会社の登録に失敗しました")
      }

      // 完了画面にリダイレクト
      const companyId = result.data?.company_id
      if (!companyId) {
        throw new Error("会社IDの取得に失敗しました")
      }
      router.push(`/admin/companies/${companyId}/complete`)
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
        <CompanyForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    </AdminLayout>
  )
}
