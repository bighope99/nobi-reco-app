"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { CompanyAdminForm } from "@/components/admin/company-admin-form";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
}

interface SuccessResult {
  company_name: string;
  admin_user_name: string;
  admin_user_email: string;
}

interface CompanyAdminFormData {
  company_id: string;
  admin_user: {
    name: string;
    email: string;
  };
}

export default function NewCompanyAdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/admin/companies");
        const data = await response.json();

        if (data.success && data.data?.companies) {
          const companyList = data.data.companies.map((company: { id: string; name: string }) => ({
            id: company.id,
            name: company.name,
          }));
          setCompanies(companyList);
        }
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const handleSubmit = async (formData: CompanyAdminFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/admin/company-admins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to register company admin");
      }

      setResult({
        company_name: result.data.company_name,
        admin_user_name: result.data.admin_user_name,
        admin_user_email: result.data.admin_user_email,
      });
    } catch (error) {
      console.error("Registration failed:", error);
      setSubmitError(error instanceof Error ? error.message : "登録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout title="管理者登録" subtitle="既存会社に管理者を追加">
      <div className="mx-auto max-w-2xl">
        {result ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <h3 className="text-lg font-semibold text-green-800">登録完了</h3>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-green-700 font-medium w-24">会社名:</dt>
                  <dd className="text-green-800">{result.company_name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-green-700 font-medium w-24">管理者名:</dt>
                  <dd className="text-green-800">{result.admin_user_name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-green-700 font-medium w-24">メール:</dt>
                  <dd className="text-green-800">{result.admin_user_email}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-green-700">招待メールを送信しました。</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" asChild>
                <Link href="/admin/companies">会社一覧に戻る</Link>
              </Button>
              <Button onClick={() => setResult(null)}>
                続けて登録
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <p className="text-muted-foreground">読み込み中...</p>
        ) : (
          <>
            {submitError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600 mb-4">
                {submitError}
              </div>
            )}
            <CompanyAdminForm
              companies={companies}
              onSubmit={handleSubmit}
              onCancel={() => window.history.back()}
              isSubmitting={isSubmitting}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
