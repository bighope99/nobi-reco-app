"use client"

import React, { useEffect, useState } from "react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { useRole } from "@/hooks/useRole"
import { useSession } from "@/hooks/useSession"
import { Loader2, ArrowLeftRight, ChevronRight } from "lucide-react"

// --- Types ---

type Step = 1 | 2 | 3

interface ChildRow {
  child_id: string
  name: string
  grade: number | null
  grade_label: string
  class_name: string
  school_name: string | null
  facility_name: string
}

interface ClassOption {
  class_id: string
  class_name: string
}

interface SchoolOption {
  school_id: string
  name: string
}

interface FacilityOption {
  facility_id: string
  name: string
}

interface PreviewChild {
  child_id: string
  name: string
  current_class_name: string | null
  current_school_name: string | null
  current_facility_name: string
  target_class_name: string | null
  target_school_name: string | null
  target_facility_name: string | null
  changes: {
    class: boolean
    school: boolean
    facility: boolean
  }
}

interface ChildrenAPIResponse {
  success: boolean
  data: {
    children: Array<{
      child_id: string
      name: string
      grade: number | null
      grade_label: string
      class_name: string
      school_name: string | null
      facility_name: string
    }>
    filters: {
      classes: ClassOption[]
    }
  }
  error?: string
}

// --- Step Indicator ---

function StepIndicator({ current }: { current: Step }) {
  const steps: Array<{ number: Step; label: string }> = [
    { number: 1, label: "子どもを選択" },
    { number: 2, label: "移動先を設定" },
    { number: 3, label: "確認・実行" },
  ]

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, i) => (
        <React.Fragment key={step.number}>
          {i > 0 && <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                current === step.number
                  ? "bg-purple-600 text-white"
                  : current > step.number
                  ? "bg-purple-200 text-purple-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {step.number}
            </div>
            <span
              className={`text-sm font-medium whitespace-nowrap ${
                current === step.number ? "text-purple-700" : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

// --- Step 1: 子どもを選択 ---

function Step1SelectChildren({
  selectedIds,
  onSelect,
  onNext,
  isAdmin,
}: {
  selectedIds: Set<string>
  onSelect: (ids: Set<string>) => void
  onNext: () => void
  isAdmin: boolean
}) {
  type SortKey = "name" | "grade" | "school_name" | "class_name" | "facility_name"
  type SortDir = "asc" | "desc"

  const [children, setChildren] = useState<ChildRow[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [filterClass, setFilterClass] = useState("all")
  const [filterGrade, setFilterGrade] = useState("all")
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("grade")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ status: "enrolled" })
        const response = await fetch(`/api/children?${params.toString()}`)
        const json: ChildrenAPIResponse = await response.json()
        if (!response.ok || !json.success) {
          throw new Error(json.error || "子ども一覧の取得に失敗しました")
        }
        setChildren(
          json.data.children.map((c) => ({
            child_id: c.child_id,
            name: c.name,
            grade: c.grade,
            grade_label: c.grade_label,
            class_name: c.class_name,
            school_name: c.school_name,
            facility_name: c.facility_name,
          }))
        )
        setClasses(json.data.filters?.classes ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }
    fetchChildren()
  }, [])

  const hasAnyClass = children.some((c) => c.class_name)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "grade" ? "desc" : "asc")
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
  }

  const filtered = children
    .filter((c) => {
      const matchClass =
        filterClass === "all" ||
        (filterClass === "none" ? !c.class_name : c.class_name === classes.find((cl) => cl.class_id === filterClass)?.class_name)
      const matchGrade =
        filterGrade === "all" || String(c.grade) === filterGrade
      const matchSearch =
        search === "" || c.name.includes(search)
      return matchClass && matchGrade && matchSearch
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "grade") {
        if (a.grade === null && b.grade === null) cmp = 0
        else if (a.grade === null) cmp = 1
        else if (b.grade === null) cmp = -1
        else cmp = a.grade - b.grade
      } else if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, "ja")
      } else if (sortKey === "school_name") {
        cmp = (a.school_name ?? "").localeCompare(b.school_name ?? "", "ja")
      } else if (sortKey === "class_name") {
        cmp = (a.class_name ?? "").localeCompare(b.class_name ?? "", "ja")
      } else if (sortKey === "facility_name") {
        cmp = a.facility_name.localeCompare(b.facility_name, "ja")
      }
      return sortDir === "asc" ? cmp : -cmp
    })

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.child_id))

  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds)
      filtered.forEach((c) => next.delete(c.child_id))
      onSelect(next)
    } else {
      const next = new Set(selectedIds)
      filtered.forEach((c) => next.add(c.child_id))
      onSelect(next)
    }
  }

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onSelect(next)
  }

  return (
    <div>
      {/* フィルター */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
        >
          <option value="all">全学年</option>
          {[6, 5, 4, 3, 2, 1].map((g) => (
            <option key={g} value={String(g)}>{g}年生</option>
          ))}
        </select>
        {classes.length > 0 && (
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="all">全クラス</option>
            <option value="none">クラスなし</option>
            {classes.map((cls) => (
              <option key={cls.class_id} value={cls.class_id}>
                {cls.class_name}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="氏名で検索"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 選択数 */}
      <p className="text-sm text-gray-500 mb-3">
        {selectedIds.size}件選択中
      </p>

      {/* テーブル */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {(["name", "grade", "school_name"] as SortKey[]).map((key) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
                    onClick={() => handleSort(key)}
                  >
                    {key === "name" ? "氏名" : key === "grade" ? "学年" : "所属学校"}
                    {sortIndicator(key)}
                  </th>
                ))}
                {hasAnyClass && (
                  <th
                    className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
                    onClick={() => handleSort("class_name")}
                  >
                    クラス{sortIndicator("class_name")}
                  </th>
                )}
                {isAdmin && (
                  <th
                    className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
                    onClick={() => handleSort("facility_name")}
                  >
                    施設{sortIndicator("facility_name")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3 + (hasAnyClass ? 1 : 0) + (isAdmin ? 1 : 0) + 1} className="px-4 py-8 text-center text-gray-400">
                    該当する子どもが見つかりません
                  </td>
                </tr>
              ) : (
                filtered.map((child) => (
                  <tr
                    key={child.child_id}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleOne(child.child_id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(child.child_id)}
                        onChange={() => toggleOne(child.child_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{child.name}</td>
                    <td className="px-4 py-3 text-gray-600">{child.grade_label || "−"}</td>
                    <td className="px-4 py-3 text-gray-600">{child.school_name || "−"}</td>
                    {hasAnyClass && (
                      <td className="px-4 py-3 text-gray-600">{child.class_name || "−"}</td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-600">{child.facility_name}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button
          className="px-5 py-2.5 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          disabled={selectedIds.size === 0}
          onClick={onNext}
        >
          次へ（{selectedIds.size}件）
        </button>
      </div>
    </div>
  )
}

// --- Step 2: 移動先を設定 ---

function Step2SetDestination({
  isAdmin,
  currentFacilityId,
  targetClassId,
  targetSchoolId,
  targetFacilityId,
  onChangeClass,
  onChangeSchool,
  onChangeFacility,
  onBack,
  onNext,
}: {
  isAdmin: boolean
  currentFacilityId: string | null
  targetClassId: string
  targetSchoolId: string
  targetFacilityId: string
  onChangeClass: (v: string) => void
  onChangeSchool: (v: string) => void
  onChangeFacility: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const facilityId = targetFacilityId || currentFacilityId || ""

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true)
        setError(null)

        const fetchId = facilityId
        const [classesRes, schoolsRes] = await Promise.all([
          fetch(`/api/children/classes${fetchId ? `?facility_id=${fetchId}` : ""}`),
          fetch(`/api/schools${fetchId ? `?facility_id=${fetchId}` : ""}`),
        ])
        const [classesJson, schoolsJson] = await Promise.all([
          classesRes.json(),
          schoolsRes.json(),
        ])
        if (!classesRes.ok || !classesJson.success) {
          throw new Error(classesJson.error || "クラスの取得に失敗しました")
        }
        if (!schoolsRes.ok || !schoolsJson.success) {
          throw new Error(schoolsJson.error || "学校の取得に失敗しました")
        }
        setClasses(classesJson.data?.classes ?? [])
        setSchools(
          (schoolsJson.data?.schools ?? []).map((s: { school_id: string; name: string }) => ({
            school_id: s.school_id,
            name: s.name,
          }))
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }
    fetchOptions()
  }, [facilityId])

  useEffect(() => {
    if (!isAdmin) return
    const fetchFacilities = async () => {
      try {
        const res = await fetch("/api/facilities")
        const json = await res.json()
        if (res.ok && json.success) {
          setFacilities(json.data?.facilities ?? [])
        }
      } catch {
        // 施設一覧が取れなくても graceful degradation
      }
    }
    fetchFacilities()
  }, [isAdmin])

  const hasSelection =
    targetClassId !== "" || targetSchoolId !== "" || targetFacilityId !== ""

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* 施設選択（company_admin のみ） */}
          {isAdmin && facilities.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                施設
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white max-w-sm"
                value={targetFacilityId}
                onChange={(e) => onChangeFacility(e.target.value)}
              >
                <option value="">変更なし</option>
                {facilities.map((f) => (
                  <option key={f.facility_id} value={f.facility_id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 施設管理者向け注意書き */}
          {!isAdmin && (
            <p className="text-xs text-gray-400">
              ※ 施設の変更は会社管理者権限で行えます
            </p>
          )}

          {/* 学校選択 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              学校
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white max-w-sm"
              value={targetSchoolId}
              onChange={(e) => onChangeSchool(e.target.value)}
            >
              <option value="">変更なし</option>
              {schools.map((s) => (
                <option key={s.school_id} value={s.school_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* クラス選択 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              クラス
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white max-w-sm"
              value={targetClassId}
              onChange={(e) => onChangeClass(e.target.value)}
            >
              <option value="">変更なし</option>
              {classes.map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_name}
                </option>
              ))}
            </select>
          </div>

          {!hasSelection && (
            <p className="text-sm text-amber-600">
              施設・学校・クラスのいずれか1つ以上を選択してください
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          className="px-5 py-2.5 rounded-lg text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={onBack}
        >
          戻る
        </button>
        <button
          className="px-5 py-2.5 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          disabled={!hasSelection || loading}
          onClick={onNext}
        >
          プレビュー
        </button>
      </div>
    </div>
  )
}

// --- Step 3: 確認・実行 ---

function Step3ConfirmAndExecute({
  selectedIds,
  targetClassId,
  targetSchoolId,
  targetFacilityId,
  isAdmin,
  onBack,
}: {
  selectedIds: Set<string>
  targetClassId: string
  targetSchoolId: string
  targetFacilityId: string
  isAdmin: boolean
  onBack: () => void
}) {
  const [preview, setPreview] = useState<PreviewChild[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [updatedCount, setUpdatedCount] = useState(0)

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true)
        setError(null)
        const body: Record<string, unknown> = {
          mode: "preview",
          childIds: Array.from(selectedIds),
        }
        if (targetClassId) body.targetClassId = targetClassId
        if (targetSchoolId) body.targetSchoolId = targetSchoolId
        if (targetFacilityId) body.targetFacilityId = targetFacilityId

        const res = await fetch("/api/children/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "プレビューの取得に失敗しました")
        }
        setPreview(json.data?.children ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "プレビューの取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }
    fetchPreview()
  }, [selectedIds, targetClassId, targetSchoolId, targetFacilityId])

  const handleExecute = async () => {
    try {
      setExecuting(true)
      setError(null)
      const body: Record<string, unknown> = {
        mode: "commit",
        childIds: Array.from(selectedIds),
      }
      if (targetClassId) body.targetClassId = targetClassId
      if (targetSchoolId) body.targetSchoolId = targetSchoolId
      if (targetFacilityId) body.targetFacilityId = targetFacilityId

      const res = await fetch("/api/children/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "実行に失敗しました")
      }
      setUpdatedCount(json.data?.updated_count ?? 0)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "実行に失敗しました")
    } finally {
      setExecuting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ArrowLeftRight size={28} className="text-purple-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          付け替えが完了しました
        </h3>
        <p className="text-sm text-gray-500 mb-8">{updatedCount}件の子どもを更新しました</p>
        <a
          href="/children"
          className="inline-block px-6 py-2.5 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          子ども一覧に戻る
        </a>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">氏名</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">変更前クラス</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">変更後クラス</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">変更前学校名</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">変更後学校名</th>
                {isAdmin && (
                  <>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">変更前施設名</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">変更後施設名</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {preview.map((child) => (
                <tr key={child.child_id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">{child.name}</td>
                  <td className="px-4 py-3 text-gray-600">{child.current_class_name ?? "−"}</td>
                  <td className="px-4 py-3">
                    {child.changes.class ? (
                      <span className="text-purple-700 font-medium">
                        {child.target_class_name ?? "−"}
                      </span>
                    ) : (
                      <span className="text-gray-400">変更なし</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{child.current_school_name ?? "−"}</td>
                  <td className="px-4 py-3">
                    {child.changes.school ? (
                      <span className="text-purple-700 font-medium">
                        {child.target_school_name ?? "−"}
                      </span>
                    ) : (
                      <span className="text-gray-400">変更なし</span>
                    )}
                  </td>
                  {isAdmin && (
                    <>
                      <td className="px-4 py-3 text-gray-600">{child.current_facility_name || "−"}</td>
                      <td className="px-4 py-3">
                        {child.changes.facility ? (
                          <span className="text-purple-700 font-medium">
                            {child.target_facility_name ?? "−"}
                          </span>
                        ) : (
                          <span className="text-gray-400">変更なし</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button
          className="px-5 py-2.5 rounded-lg text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={onBack}
          disabled={executing}
        >
          戻る
        </button>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          onClick={handleExecute}
          disabled={executing || loading || preview.length === 0}
        >
          {executing && <Loader2 size={16} className="animate-spin" />}
          実行（{preview.length}件）
        </button>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function ChildrenTransferPage() {
  const { isAdmin, isFacilityAdmin } = useRole()
  const session = useSession()

  const [step, setStep] = useState<Step>(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [targetClassId, setTargetClassId] = useState("")
  const [targetSchoolId, setTargetSchoolId] = useState("")
  const [targetFacilityId, setTargetFacilityId] = useState("")

  // staff はアクセス不可
  if (session !== undefined && !isAdmin && !isFacilityAdmin) {
    return (
      <StaffLayout title="子ども一括付け替え">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <p className="text-gray-500 text-sm">このページへのアクセス権限がありません</p>
            <a href="/children" className="text-purple-600 text-sm hover:underline mt-2 inline-block">
              子ども一覧に戻る
            </a>
          </div>
        </div>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout title="子ども一括付け替え" subtitle="クラス・学校・施設を一括で変更します">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <ArrowLeftRight size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">子ども一括付け替え</h1>
            <p className="text-sm text-gray-500">クラス・学校・施設を一括で変更します</p>
          </div>
        </div>

        {/* ステップインジケーター */}
        <StepIndicator current={step} />

        {/* カード */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          {step === 1 && (
            <Step1SelectChildren
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
              onNext={() => setStep(2)}
              isAdmin={isAdmin}
            />
          )}
          {step === 2 && (
            <Step2SetDestination
              isAdmin={isAdmin}
              currentFacilityId={session?.current_facility_id ?? null}
              targetClassId={targetClassId}
              targetSchoolId={targetSchoolId}
              targetFacilityId={targetFacilityId}
              onChangeClass={setTargetClassId}
              onChangeSchool={setTargetSchoolId}
              onChangeFacility={setTargetFacilityId}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3ConfirmAndExecute
              selectedIds={selectedIds}
              targetClassId={targetClassId}
              targetSchoolId={targetSchoolId}
              targetFacilityId={targetFacilityId}
              isAdmin={isAdmin}
              onBack={() => setStep(2)}
            />
          )}
        </div>
      </div>
    </StaffLayout>
  )
}
