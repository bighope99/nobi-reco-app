import { NextResponse } from "next/server"
import { mockChildren, mockClasses } from "@/lib/mock-data"
import type { AttendanceStatus } from "@/types/attendance"

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"] as const
const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const

const gradeLabel = (age: number) => {
  if (age >= 6) return "年長"
  if (age === 5) return "年中"
  return "年少"
}

const toKana = (name: string) => {
  // 簡易的なダミー変換（デモ用）
  return name.replace(/ /g, " ")
}

const buildCheckInTime = (childId: string, status: AttendanceStatus, date: string) => {
  if (status === "absent" || status === "not_arrived") return { checked_in_at: null, checked_out_at: null }

  const seed = childId.charCodeAt(0) + childId.length
  const baseHour = status === "late" ? 10 : 8
  const minutes = (seed * 7) % 50
  const hour = baseHour + Math.floor(minutes / 60)
  const paddedMinutes = String(minutes % 60).padStart(2, "0")

  const checkIn = `${date}T${String(hour).padStart(2, "0")}:${paddedMinutes}:00+09:00`
  const checkOutHour = Math.min(18, hour + 8)
  const checkOut = `${date}T${String(checkOutHour).padStart(2, "0")}:${paddedMinutes}:00+09:00`

  return {
    checked_in_at: checkIn,
    checked_out_at: status === "late" ? null : checkOut,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const dateParam = searchParams.get("date")
  const classId = searchParams.get("class_id")
  const statusFilter = searchParams.get("status") as AttendanceStatus | null
  const search = searchParams.get("search")?.trim()

  const today = new Date()
  const targetDate = dateParam ? new Date(dateParam) : today

  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid date" }, { status: 400 })
  }

  const isoDate = targetDate.toISOString().split("T")[0]
  const weekday = targetDate.getDay()

  const statusMap: Record<string, AttendanceStatus> = {
    present: "present",
    absent: "absent",
    late: "late",
    not_arrived: "not_arrived",
  }

  const children = mockChildren
    .map((child) => {
      const classInfo = mockClasses.find((cls) => cls.name === child.className) ?? {
        id: child.className,
        name: child.className,
        childrenCount: mockChildren.filter((c) => c.className === child.className).length,
      }

      const status = statusMap[child.status as AttendanceStatus] ?? "not_arrived"
      const { checked_in_at, checked_out_at } = buildCheckInTime(child.id, status, isoDate)

      return {
        child_id: child.id,
        name: child.name,
        kana: toKana(child.name),
        class_id: classInfo.id,
        class_name: classInfo.name,
        grade: gradeLabel(child.age),
        photo_url: "",
        status,
        is_expected: true,
        is_unexpected: false,
        checked_in_at,
        checked_out_at,
        scan_method: status === "present" || status === "late" ? "qr" : null,
      }
    })
    .filter((child) => {
      if (classId && child.class_id !== classId) return false
      if (statusFilter && child.status !== statusFilter) return false
      if (search && !(child.name.includes(search) || child.kana.includes(search))) return false
      return true
    })

  const summary = {
    total_children: children.length,
    present_count: children.filter((child) => child.status === "present").length,
    absent_count: children.filter((child) => child.status === "absent").length,
    late_count: children.filter((child) => child.status === "late").length,
    not_checked_in_count: children.filter((child) => child.status === "not_arrived").length,
  }

  const filters = {
    classes: mockClasses.map((cls) => {
      const presentCount = mockChildren.filter((child) => child.className === cls.name && child.status === "present").length
      return {
        class_id: cls.id,
        class_name: cls.name,
        present_count: presentCount,
        total_count: mockChildren.filter((child) => child.className === cls.name).length,
      }
    }),
  }

  return NextResponse.json({
    success: true,
    data: {
      date: isoDate,
      weekday: weekdayNames[weekday],
      weekday_jp: weekdayLabels[weekday],
      summary,
      children,
      filters,
    },
  })
}
