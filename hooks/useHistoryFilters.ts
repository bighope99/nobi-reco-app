'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'

export interface ClassOption {
  class_id: string
  name: string
}

export interface StaffOption {
  id: string
  name: string
}

interface UseHistoryFiltersOptions {
  enableChildName?: boolean
  enableGrade?: boolean
}

interface UseHistoryFiltersReturn {
  searchParams: ReturnType<typeof useSearchParams>
  fromDate: string
  setFromDate: (v: string) => void
  toDate: string
  setToDate: (v: string) => void
  selectedClass: string
  setSelectedClass: (v: string) => void
  selectedStaff: string
  setSelectedStaff: (v: string) => void
  keyword: string
  setKeyword: (v: string) => void
  debouncedKeyword: string
  classes: ClassOption[]
  staffList: StaffOption[]
  childName: string
  setChildName: (v: string) => void
  selectedGrade: string
  setSelectedGrade: (v: string) => void
}

export function useHistoryFilters(options: UseHistoryFiltersOptions = {}): UseHistoryFiltersReturn {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [fromDate, setFromDate] = useState(() => searchParams.get("from_date") ?? "")
  const [toDate, setToDate] = useState(() => searchParams.get("to_date") ?? "")
  const [selectedClass, setSelectedClass] = useState(() => searchParams.get("class_id") ?? "all")
  const [selectedStaff, setSelectedStaff] = useState("all")
  const [keyword, setKeyword] = useState("")
  const debouncedKeyword = useDebounce(keyword, 500)

  const [childName, setChildName] = useState("")
  const [selectedGrade, setSelectedGrade] = useState("")

  const [classes, setClasses] = useState<ClassOption[]>([])
  const [staffList, setStaffList] = useState<StaffOption[]>([])

  // searchParams → state 同期
  useEffect(() => {
    const nextFromDate = searchParams.get("from_date") ?? ""
    const nextToDate = searchParams.get("to_date") ?? ""
    const nextClassId = searchParams.get("class_id") ?? "all"

    setFromDate((current) => (current === nextFromDate ? current : nextFromDate))
    setToDate((current) => (current === nextToDate ? current : nextToDate))
    setSelectedClass((current) => (current === nextClassId ? current : nextClassId))
  }, [searchParams])

  // state → URL パラメータ更新
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (fromDate) {
      params.set("from_date", fromDate)
    } else {
      params.delete("from_date")
    }

    if (toDate) {
      params.set("to_date", toDate)
    } else {
      params.delete("to_date")
    }

    if (selectedClass !== "all") {
      params.set("class_id", selectedClass)
    } else {
      params.delete("class_id")
    }

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
    }
  }, [fromDate, toDate, selectedClass, pathname, router, searchParams])

  // メタデータ取得
  useEffect(() => {
    const fetchMeta = async () => {
      const classRes = await fetch('/api/classes')
      if (classRes.ok) {
        const classJson = await classRes.json()
        if (classJson.success) setClasses(classJson.data?.classes || [])
        else console.error('Class fetch error:', classJson)
      } else {
        console.error('Class fetch failed:', classRes.status, await classRes.text())
      }

      const staffRes = await fetch('/api/users?is_active=true')
      if (staffRes.ok) {
        const staffJson = await staffRes.json()
        if (staffJson.success) setStaffList(
          (staffJson.data?.users || []).map((u: { user_id: string; name: string }) => ({ id: u.user_id, name: u.name }))
        )
        else console.error('Staff fetch error:', staffJson)
      } else {
        console.error('Staff fetch failed:', staffRes.status, await staffRes.text())
      }
    }
    fetchMeta()
  }, [])

  return {
    searchParams,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    selectedClass,
    setSelectedClass,
    selectedStaff,
    setSelectedStaff,
    keyword,
    setKeyword,
    debouncedKeyword,
    classes,
    staffList,
    childName,
    setChildName,
    selectedGrade,
    setSelectedGrade,
  }
}
