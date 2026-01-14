"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import {
  CompanyForm,
  type CompanyFormData,
  type CompanyFormSubmitData,
} from "@/components/admin/company-form"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CompanyApiResponse {
  success: boolean
  data?: {
    company: CompanyFormData & { id: string }
  }
  error?: string
}

export default function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [companyData, setCompanyData] = useState<CompanyFormData | null>(null)
  const [companyName, setCompanyName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/admin/companies/${id}`)
        const data: CompanyApiResponse = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || "会社情報の取得に失敗しました")
        }

        if (data.data?.company) {
          const company = data.data.company
          setCompanyData({
            name: company.name,
            name_kana: company.name_kana,
            postal_code: company.postal_code,
            address: company.address,
            phone: company.phone,
            email: company.email,
          })
          setCompanyName(company.name)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "会社情報の取得に失敗しました")
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompany()
  }, [id])

  const handleSubmit = async (data: CompanyFormSubmitData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/admin/companies/${id}`, {
        method: "PUT",
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
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || "会社情報の更新に失敗しました")
      }

      router.push("/admin/companies")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    router.push("/admin/companies")
  }

  // Loading state
  if (isLoading) {
    return (
      <AdminLayout title="会社編集">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">読み込み中...</span>
        </div>
      </AdminLayout>
    )
  }

  // Error state
  if (error || !companyData) {
    return (
      <AdminLayout title="会社編集">
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
    <AdminLayout title="会社編集" subtitle={companyName}>
      <div className="mx-auto max-w-2xl">
        <CompanyForm
          mode="edit"
          initialData={{ company: companyData }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    </AdminLayout>
  )
}
