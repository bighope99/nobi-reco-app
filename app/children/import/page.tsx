"use client"

import React, { useEffect, useRef, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
type SiblingCandidate = {
  phone_key: string
  guardian_names: string[]
  children: Array<{
    source: "existing" | "import"
    name: string
    row?: number
  }>
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
    sibling_candidates: SiblingCandidate[]
  } | null>(null)
  const [approvedSiblingPhones, setApprovedSiblingPhones] = useState<string[]>([])
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
      setApprovedSiblingPhones([])
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
      formData.append("approved_phone_keys", JSON.stringify(approvedSiblingPhones))
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
      setApprovedSiblingPhones([])
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

  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewResult(null)
    setImportResult(null)
    setApprovedSiblingPhones([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const toggleSiblingApproval = (phoneKey: string, checked: boolean) => {
    setApprovedSiblingPhones((prev) => {
      if (checked) {
        return prev.includes(phoneKey) ? prev : [...prev, phoneKey]
      }
      return prev.filter((key) => key !== phoneKey)
    })
  }

  return (
    <StaffLayout
      title="CSV一括登録"
      subtitle="CSVファイルから子どもを一括登録"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* CSVアップロードとテンプレート（プレビュー非表示時のみ） */}
        {!selectedFile && !previewLoading && !previewResult && (
          <>
            <Card className="border-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">CSVファイル</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex h-44 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-gradient-to-br from-muted/30 to-muted/60 transition-all hover:border-primary/50 hover:bg-muted/80">
                  <Upload className="mb-3 h-10 w-10 text-muted-foreground/70" />
                  <p className="text-sm font-medium text-foreground/80">
                    CSVファイルをドラッグ＆ドロップ
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">または</p>
                  <Button variant="outline" size="sm" className="mt-3 bg-background/80 backdrop-blur" asChild>
                    <label htmlFor="child-import-file" className="cursor-pointer">ファイルを選択</label>
                  </Button>
                  <input
                    id="child-import-file"
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleFileChange}
                    onClick={(event) => {
                      (event.currentTarget as HTMLInputElement).value = ""
                    }}
                    ref={fileInputRef}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">CSVテンプレート</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  文字化けを防ぐため、UTF-8（BOM付き）で出力しています。
                </p>
                <Button variant="outline" className="w-full font-medium" asChild>
                  <a href="/children/import/template" download>
                    <Download className="mr-2 h-4 w-4" />
                    テンプレートをダウンロード
                  </a>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* 保存・キャンセルボタン（プレビュー表示時のみ） */}
        {(selectedFile || previewResult || previewLoading) && (
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              {error && (
                <p className="text-sm text-red-600 mb-3">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-3">
                {selectedFile && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-background/80 border border-primary/20 rounded-lg flex-1">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-sm font-medium text-foreground/90 truncate">
                      {selectedFile.name}
                    </p>
                  </div>
                )}
                <Button
                  className="font-semibold shadow-sm transition-all hover:shadow-md min-w-[120px]"
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
                <Button
                  variant="outline"
                  className="font-semibold min-w-[120px]"
                  onClick={handleCancel}
                  disabled={loading || previewLoading}
                >
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 取り込み内容の確認（所属設定を含む） */}
        {(previewResult || previewLoading) && (
          <Card className="border-2">
            <CardHeader className="pb-4 border-b bg-gradient-to-r from-background to-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">取り込み内容の確認</CardTitle>
                {previewResult && (
                  <div className="flex gap-3 text-sm font-medium">
                    <span className="px-3 py-1 bg-muted/80 rounded-full">
                      合計 <span className="font-bold">{previewResult.total}</span> 件
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
                      登録可能 <span className="font-bold">{previewResult.success_count}</span>
                    </span>
                    {previewResult.failure_count > 0 && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full">
                        エラー <span className="font-bold">{previewResult.failure_count}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* 所属設定セクション */}
              <div className="space-y-4 p-5 bg-amber-50/50 border-2 border-amber-200/60 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base font-semibold">所属設定</h3>
                  <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    取り込み前の確認
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  CSVの取り込み対象として、所属施設・学校・クラスを指定してください。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">子どもの所属施設</Label>
                    <Select
                      value={selectedFacilityId}
                      onValueChange={setSelectedFacilityId}
                      disabled={loading || previewLoading}
                    >
                      <SelectTrigger className="bg-background/80 backdrop-blur">
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
                    <Label className="text-sm font-semibold">子どもの所属学校</Label>
                    <Select
                      value={selectedSchoolId}
                      onValueChange={setSelectedSchoolId}
                      disabled={loading || previewLoading}
                    >
                      <SelectTrigger className="bg-background/80 backdrop-blur">
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
                    <Label className="text-sm font-semibold">子どもの所属クラス</Label>
                    <Select
                      value={selectedClassId}
                      onValueChange={setSelectedClassId}
                      disabled={loading || previewLoading}
                    >
                      <SelectTrigger className="bg-background/80 backdrop-blur">
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
                <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-amber-200/40">
                  選択内容はプレビューと保存時の両方に反映されます。
                </p>
              </div>

              {/* プレビューテーブル */}
              {previewLoading && (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center space-y-3">
                    <div className="h-12 w-12 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm font-medium text-muted-foreground">プレビューを読み込み中...</p>
                  </div>
                </div>
              )}
              {previewResult && (
                <div className="space-y-0 -mx-6">
                  {previewResult.failure_count > 0 && (
                    <div className="px-6 py-4 bg-red-50 border-y border-red-200/40">
                      <p className="text-sm text-red-700 font-medium leading-relaxed">
                        ⚠️ エラーがある行は保存できません。内容を修正して再アップロードしてください。
                      </p>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-muted/60 to-muted/40 border-b-2 border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 w-16">行</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 min-w-[140px]">氏名</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 min-w-[120px]">生年月日</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 w-20">性別</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 min-w-[100px]">入所状況</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 min-w-[120px]">入所日</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 min-w-[140px]">保護者氏名</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground/80 min-w-[200px]">エラー</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {previewResult.rows.map((row, idx) => (
                          <tr
                            key={row.row}
                            className={`transition-colors hover:bg-muted/30 ${
                              row.errors.length > 0 ? 'bg-red-50/40' : idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                            }`}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.row}</td>
                            <td className="px-4 py-3 font-medium">
                              {row.family_name} {row.given_name}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{row.birth_date}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                row.gender === '男' ? 'bg-blue-100 text-blue-700' :
                                row.gender === '女' ? 'bg-pink-100 text-pink-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {row.gender}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                row.enrollment_status === '在籍' ? 'bg-green-100 text-green-700' :
                                row.enrollment_status === '退所' ? 'bg-gray-100 text-gray-600' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {row.enrollment_status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{row.enrolled_at}</td>
                            <td className="px-4 py-3">{row.parent_name}</td>
                            <td className="px-4 py-3">
                              {row.errors.length > 0 && (
                                <span className="text-xs text-red-600 font-medium leading-relaxed">
                                  {row.errors.join(", ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-5 border-t bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground/80">兄弟候補の確認</h4>
                      <span className="text-xs text-muted-foreground">
                        電話番号単位で承認（表示は保護者名）
                      </span>
                    </div>
                    {previewResult.sibling_candidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">兄弟候補はありません。</p>
                    ) : (
                      <div className="space-y-3">
                        {previewResult.sibling_candidates.map((candidate) => (
                          <div
                            key={candidate.phone_key}
                            className="rounded-lg border bg-background/80 p-4 space-y-2"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`sibling-${candidate.phone_key}`}
                                checked={approvedSiblingPhones.includes(candidate.phone_key)}
                                onCheckedChange={(checked) =>
                                  toggleSiblingApproval(candidate.phone_key, Boolean(checked))
                                }
                              />
                              <label
                                htmlFor={`sibling-${candidate.phone_key}`}
                                className="text-sm font-semibold cursor-pointer"
                              >
                                承認する
                              </label>
                              <span className="text-xs text-muted-foreground">
                                保護者: {candidate.guardian_names.join(" / ")}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              兄弟候補:
                              {candidate.children.map((child) => (
                                <span key={`${candidate.phone_key}-${child.name}-${child.row ?? ""}`} className="ml-2">
                                  {child.source === "import" ? "新規" : "既存"}:{child.name}
                                  {child.row ? `(${child.row}行目)` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* インポート結果 */}
        {importResult && (
          <Card className="border-2 border-green-200/60 bg-green-50/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-green-900">インポート結果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4 text-sm font-medium">
                <span className="text-muted-foreground">合計 <span className="text-foreground">{importResult.total}</span> 件</span>
                <span className="text-green-700">成功 {importResult.success_count} 件</span>
                {importResult.failure_count > 0 && (
                  <span className="text-red-600">失敗 {importResult.failure_count} 件</span>
                )}
              </div>
              {importResult.failure_count > 0 && (
                <div className="space-y-2 pt-2 border-t border-green-200/40">
                  {importResult.results
                    .filter((result) => !result.success)
                    .slice(0, 10)
                    .map((result) => (
                      <p key={result.row} className="text-sm text-red-600 leading-relaxed">
                        {result.row}行目: {result.message || "エラー"}
                      </p>
                    ))}
                  {importResult.failure_count > 10 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      失敗は先頭10件のみ表示しています。
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </StaffLayout>
  )
}
