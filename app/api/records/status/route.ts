import { NextResponse } from "next/server"
import { mockChildren, mockClasses } from "@/lib/mock-data"

const gradeLabel = (age: number) => {
  if (age >= 6) return "年長"
  if (age === 5) return "年中"
  return "年少"
}

const toKana = (name: string) => {
  // シンプルな疑似かな変換（デモ用）
  return name.replace(/ /g, " ")
}

const buildDailyStatus = (childId: string, days: number) => {
  const statuses: Array<"present" | "absent" | "late" | "none"> = []
  for (let day = 1; day <= days; day++) {
    const hash = (childId.charCodeAt(0) + day) % 11
    if (hash % 5 === 0) {
      statuses.push("absent")
    } else if (hash % 4 === 0) {
      statuses.push("late")
    } else if (hash % 6 === 0) {
      statuses.push("none")
    } else {
      statuses.push("present")
    }
  }
  return statuses
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const yearParam = searchParams.get("year")
  const monthParam = searchParams.get("month")
  const classId = searchParams.get("class_id")
  const search = searchParams.get("search")?.trim()
  const warningOnly = searchParams.get("warning_only") === "true"

  const today = new Date()
  const year = yearParam ? parseInt(yearParam, 10) : today.getFullYear()
  const month = monthParam ? parseInt(monthParam, 10) : today.getMonth() + 1

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ success: false, error: "Invalid year or month" }, { status: 400 })
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`

  const classLookup = Object.fromEntries(mockClasses.map((cls) => [cls.id, cls]))

  const children = mockChildren
    .map((child) => {
      const dailyStatus = buildDailyStatus(child.id, daysInMonth)
      const monthlyAttendanceCount = dailyStatus.filter((status) => status === "present" || status === "late").length
      const monthlyRecordCount = dailyStatus.filter((status) => status === "present").length
      const yearlyAttendanceCount = monthlyAttendanceCount * month
      const yearlyRecordCount = monthlyRecordCount * month

      const lastRecordedIndex = dailyStatus.lastIndexOf("present")
      const lastRecordDate = lastRecordedIndex >= 0
        ? `${year}-${String(month).padStart(2, "0")}-${String(lastRecordedIndex + 1).padStart(2, "0")}`
        : null

      const classInfo = Object.values(classLookup).find((cls) => cls.name === child.className) ?? {
        id: child.className,
        name: child.className,
      }

      return {
        child_id: child.id,
        name: child.name,
        kana: toKana(child.name),
        class_id: classInfo.id,
        class_name: classInfo.name,
        grade: gradeLabel(child.age),
        photo_url: "",
        last_record_date: lastRecordDate,
        is_recorded_today: dailyStatus[new Date().getDate() - 1] === "present",
        monthly: {
          attendance_count: monthlyAttendanceCount,
          record_count: monthlyRecordCount,
          record_rate: monthlyAttendanceCount === 0 ? 0 : Math.round((monthlyRecordCount / monthlyAttendanceCount) * 1000) / 10,
          daily_status: dailyStatus,
        },
        yearly: {
          attendance_count: yearlyAttendanceCount,
          record_count: yearlyRecordCount,
          record_rate: yearlyAttendanceCount === 0 ? 0 : Math.round((yearlyRecordCount / yearlyAttendanceCount) * 1000) / 10,
        },
      }
    })
    .filter((child) => {
      if (classId && child.class_id !== classId) return false
      if (search && !(child.name.includes(search) || child.kana.includes(search))) return false
      if (warningOnly && child.monthly.record_rate >= 80) return false
      return true
    })

  const summary = {
    total_children: children.length,
    warning_children: children.filter((child) => child.monthly.record_rate < 80).length,
    average_record_rate:
      children.length === 0
        ? 0
        : Math.round(
            (children.reduce((acc, child) => acc + child.monthly.record_rate, 0) / children.length) * 10,
          ) / 10,
  }

  return NextResponse.json({
    success: true,
    data: {
      period: {
        year,
        month,
        start_date: startDate,
        end_date: endDate,
        days_in_month: daysInMonth,
      },
      children,
      summary,
      filters: {
        classes: mockClasses.map((cls) => ({ class_id: cls.id, class_name: cls.name })),
      },
    },
  })
}
