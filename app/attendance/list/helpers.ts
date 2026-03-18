/**
 * 出席予定一覧ページのヘルパー関数
 * page.tsx から抽出したテスト可能な純粋関数群
 */

export interface ChildAttendance {
  child_id: string
  name: string
  kana: string
  class_id: string | null
  class_name: string
  age_group: string
  grade: number | null
  grade_label: string
  photo_url: string | null
  status: 'present' | 'absent' | 'late' | 'not_arrived'
  is_expected: boolean
  checked_in_at: string | null
  checked_out_at: string | null
  check_in_method: string | null
  is_unexpected: boolean
}

export interface StatusPresentation {
  label: string
  className: string
}

export interface AttendanceData {
  date: string
  weekday: string
  weekday_jp: string
  summary: {
    total_children: number
    present_count: number
    absent_count: number
    late_count: number
    not_checked_in_count: number
  }
  children: ChildAttendance[]
  filters: {
    classes: Array<{
      class_id: string
      class_name: string
      present_count: number
      total_count: number
    }>
  }
}

/** 日付が今日より過去かどうか判定 */
export const isPastDate = (dateString: string): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(dateString)
  target.setHours(0, 0, 0, 0)

  return target < today
}

/** ステータスの表示情報を取得 */
export const getStatusPresentation = (child: ChildAttendance, currentDate: string): StatusPresentation | null => {
  if (child.is_unexpected) {
    return {
      label: '予定外登園',
      className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200',
    }
  }

  if (child.status === 'present') {
    return {
      label: '出席',
      className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200',
    }
  }

  if (child.status === 'late') {
    return {
      label: '遅刻',
      className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200',
    }
  }

  if (child.status === 'absent') {
    const isPast = isPastDate(currentDate)

    if (!child.is_expected) {
      return {
        label: '欠席予定',
        className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200',
      }
    }

    return {
      label: isPast ? '欠席' : '出席予定',
      className: isPast
        ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200'
        : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200',
    }
  }

  if (child.status === 'not_arrived') {
    if (child.is_expected) {
      return {
        label: '未到着',
        className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200',
      }
    }

    return {
      label: '欠席予定',
      className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200',
    }
  }

  return null
}

/**
 * ステータスアクションボタンの表示判定
 * @returns 'absent' → 欠席にするボタン, 'present' → 出席にするボタン, null → ボタンなし
 */
export const getStatusAction = (child: ChildAttendance, currentDate: string): 'absent' | 'present' | null => {
  const presentation = getStatusPresentation(child, currentDate)
  if (!presentation) return null

  if (presentation.label === '出席予定') {
    return 'absent'
  }

  if (presentation.label === '欠席予定') {
    return 'present'
  }

  // 過去日付の場合: 出席/遅刻 → 欠席にする、欠席 → 出席にする
  const isPast = isPastDate(currentDate)
  if (isPast) {
    if (presentation.label === '欠席') {
      return 'present'
    }
    if (presentation.label === '出席' || presentation.label === '遅刻') {
      return 'absent'
    }
  }

  return null
}

/**
 * 楽観的更新: attendanceData を即座に更新する純粋関数
 */
export const applyOptimisticStatusUpdate = (
  data: AttendanceData,
  childId: string,
  nextStatus: 'absent' | 'present'
): AttendanceData => {
  const updatedChildren = data.children.map(child => {
    if (child.child_id !== childId) return child

    if (nextStatus === 'absent') {
      return {
        ...child,
        status: 'absent' as const,
        is_expected: false,
      }
    }

    // nextStatus === 'present'
    return {
      ...child,
      status: 'absent' as const,
      is_expected: true,
    }
  })

  const summary = {
    total_children: updatedChildren.length,
    present_count: updatedChildren.filter(c => c.status === 'present').length,
    absent_count: updatedChildren.filter(c => c.status === 'absent').length,
    late_count: updatedChildren.filter(c => c.status === 'late').length,
    not_checked_in_count: updatedChildren.filter(c => c.status === 'not_arrived' && c.is_expected).length,
  }

  return {
    ...data,
    children: updatedChildren,
    summary,
  }
}
