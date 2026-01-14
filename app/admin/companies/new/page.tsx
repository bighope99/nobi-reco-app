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
            email: data.company.email.trim() || undefined,
          },
          facility: data.facility
            ? {
                name: data.facility.name.trim(),
                name_kana: data.facility.name_kana.trim() || undefined,
                postal_code: data.facility.postal_code.trim() || undefined,
                address: data.facility.address.trim() || undefined,
                phone: data.facility.phone.trim() || undefined,
                capacity: data.facility.capacity
                  ? parseInt(data.facility.capacity, 10)
                  : undefined,
              }
            : undefined,
          admin_user: data.adminUser
            ? {
                name: data.adminUser.name.trim(),
                name_kana: data.adminUser.name_kana.trim() || undefined,
                email: data.adminUser.email.trim(),
              }
            : undefined,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "会社の登録に失敗しました")
      }

      router.push("/admin/companies")
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
