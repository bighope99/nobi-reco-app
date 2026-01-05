"use client"

import React, { useEffect, useRef, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, Download } from "lucide-react"

type FacilityOption = { facility_id: string; name: string }
type SchoolOption = { school_id: string; name: string }
type ClassOption = { class_id: string; class_name: string }
type PreviewRow = {
  row: number
  family_name: string
  given_name: string
  birth_date: string
  gender: string
  enrollment_status: string
  enrolled_at: string
  parent_name: string
  errors: string[]
}

export default function ChildImportPage() {
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState("")
  const [selectedSchoolId, setSelectedSchoolId] = useState("")
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{
    total: number
    success_count: number
    failure_count: number
    results: Array<{ row: number; success: boolean; message?: string }>
  } | null>(null)
  const [previewResult, setPreviewResult] = useState<{
    total: number
    success_count: number
    failure_count: number
    rows: PreviewRow[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true)
        setError(null)

        const [facilitiesResponse, schoolsResponse, classesResponse] =
          await Promise.all([
            fetch("/api/facilities"),
            fetch("/api/schools"),
            fetch("/api/children/classes"),
          ])

        const [facilitiesJson, schoolsJson, classesJson] = await Promise.all([
          facilitiesResponse.json(),
          schoolsResponse.json(),
          classesResponse.json(),
        ])

        if (!facilitiesResponse.ok || !facilitiesJson.success) {
          throw new Error(facilitiesJson.error || "施設の取得に失敗しました")
        }

        if (!schoolsResponse.ok || !schoolsJson.success) {
          throw new Error(schoolsJson.error || "学校の取得に失敗しました")
        }

        if (!classesResponse.ok || !classesJson.success) {
          throw new Error(classesJson.error || "クラスの取得に失敗しました")
        }

        setFacilities(facilitiesJson.data?.facilities ?? [])
        setSchools(
          (schoolsJson.data?.schools ?? []).map((school: any) => ({
            school_id: school.school_id,
            name: school.name,
          }))
        )
        setClasses(classesJson.data?.classes ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [])

  const requestPreview = async (file: File) => {
    try {
      setPreviewLoading(true)
      setError(null)
      setPreviewResult(null)
      setImportResult(null)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("mode", "preview")
      if (selectedFacilityId) formData.append("facility_id", selectedFacilityId)
      if (selectedSchoolId) formData.append("school_id", selectedSchoolId)
      if (selectedClassId) formData.append("class_id", selectedClassId)

      const response = await fetch("/api/children/import", {
        method: "POST",
        body: formData,
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error || "プレビューの取得に失敗しました")
      }

      setPreviewResult(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "プレビューの取得に失敗しました")
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    if (file) {
      requestPreview(file)
    }
  }

  useEffect(() => {
    if (selectedFile) {
      requestPreview(selectedFile)
    }
  }, [selectedFacilityId, selectedSchoolId, selectedClassId])

  const handleImport = async () => {
    if (!selectedFile) {
      setError("CSVファイルを選択してください")
      return
    }

    try {
      setLoading(true)
      setError(null)
      setImportResult(null)

      const formData = new FormData()
      formData.append("file", selectedFile)
      if (selectedFacilityId) formData.append("facility_id", selectedFacilityId)
      if (selectedSchoolId) formData.append("school_id", selectedSchoolId)
      if (selectedClassId) formData.append("class_id", selectedClassId)

      const response = await fetch("/api/children/import", {
        method: "POST",
        body: formData,
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error || "インポートに失敗しました")
      }

      setImportResult(null)
      setSelectedFacilityId("")
      setSelectedSchoolId("")
      setSelectedClassId("")
      setSelectedFile(null)
      setPreviewResult(null)
      setError(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <StaffLayout
      title="CSV一括登録"
      subtitle="CSVファイルから子どもを一括登録"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>一括設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              施設・学校・クラスはここで一括指定します（CSVには記載しません）。
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>子どもの所属施設</Label>
                <Select
                  value={selectedFacilityId}
                  onValueChange={setSelectedFacilityId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="施設を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((facility) => (
                      <SelectItem
                        key={facility.facility_id}
                        value={facility.facility_id}
                      >
                        {facility.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>子どもの所属学校</Label>
                <Select
                  value={selectedSchoolId}
                  onValueChange={setSelectedSchoolId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="学校を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem
                        key={school.school_id}
                        value={school.school_id}
                      >
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>子どもの所属クラス</Label>
                <Select
                  value={selectedClassId}
                  onValueChange={setSelectedClassId}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="クラスを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.class_id} value={cls.class_id}>
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              将来的に、選択内容をCSVの全行へ一括適用して取り込みます。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSVファイルのアップロード</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
              <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                CSVファイルをドラッグ＆ドロップ
              </p>
              <p className="text-xs text-muted-foreground">または</p>
              <Button variant="outline" size="sm" className="mt-2 bg-transparent" asChild>
                <label htmlFor="child-import-file">ファイルを選択</label>
              </Button>
              <input
                id="child-import-file"
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
            </div>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                選択中: {selectedFile.name}
              </p>
            )}
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={
                loading ||
                previewLoading ||
                !previewResult ||
                previewResult.failure_count > 0
              }
            >
              {loading ? "取り込み中..." : "保存する"}
            </Button>
          </CardContent>
        </Card>

        {(previewResult || previewLoading) && (
          <Card>
            <CardHeader>
              <CardTitle>取り込み内容の確認</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewLoading && (
                <p className="text-sm text-muted-foreground">プレビューを読み込み中...</p>
              )}
              {previewResult && (
                <>
                  <div className="text-sm text-muted-foreground">
                    合計 {previewResult.total} 件 / 登録可能{" "}
                    {previewResult.success_count} 件 / エラー{" "}
                    {previewResult.failure_count} 件
                  </div>
                  {previewResult.failure_count > 0 && (
                    <p className="text-xs text-red-600">
                      エラーがある行は保存できません。内容を修正して再アップロードしてください。
                    </p>
                  )}
                  <div className="overflow-x-auto border rounded-md">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">行</th>
                          <th className="px-3 py-2 text-left">氏名</th>
                          <th className="px-3 py-2 text-left">生年月日</th>
                          <th className="px-3 py-2 text-left">性別</th>
                          <th className="px-3 py-2 text-left">入所状況</th>
                          <th className="px-3 py-2 text-left">入所日</th>
                          <th className="px-3 py-2 text-left">保護者氏名</th>
                          <th className="px-3 py-2 text-left">エラー</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewResult.rows.map((row) => (
                          <tr key={row.row} className="border-t">
                            <td className="px-3 py-2">{row.row}</td>
                            <td className="px-3 py-2">
                              {row.family_name} {row.given_name}
                            </td>
                            <td className="px-3 py-2">{row.birth_date}</td>
                            <td className="px-3 py-2">{row.gender}</td>
                            <td className="px-3 py-2">{row.enrollment_status}</td>
                            <td className="px-3 py-2">{row.enrolled_at}</td>
                            <td className="px-3 py-2">{row.parent_name}</td>
                            <td className="px-3 py-2 text-red-600">
                              {row.errors.join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {importResult && (
          <Card>
            <CardHeader>
              <CardTitle>インポート結果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                合計 {importResult.total} 件 / 成功 {importResult.success_count} 件 /
                失敗 {importResult.failure_count} 件
              </div>
              {importResult.failure_count > 0 && (
                <div className="space-y-2">
                  {importResult.results
                    .filter((result) => !result.success)
                    .slice(0, 10)
                    .map((result) => (
                      <p key={result.row} className="text-sm text-red-600">
                        {result.row}行目: {result.message || "エラー"}
                      </p>
                    ))}
                  {importResult.failure_count > 10 && (
                    <p className="text-xs text-muted-foreground">
                      失敗は先頭10件のみ表示しています。
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>CSVテンプレート</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              文字化けを防ぐため、UTF-8（BOM付き）で出力しています。
            </p>
            <Button variant="outline" asChild>
              <a href="/children/import/template" download>
                <Download className="mr-2 h-4 w-4" />
                テンプレートをダウンロード
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
