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

export type TimeField = 'in' | 'out'

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

    if (isPast) {
      // 過去日付: is_expected に関係なく「欠席」
      return {
        label: '欠席',
        className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200',
      }
    }

    if (!child.is_expected) {
      return {
        label: '欠席予定',
        className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200',
      }
    }

    return {
      label: '出席予定',
      className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200',
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
 * 時間欄に「設定」導線を表示するかどうか判定
 */
export const canDisplayTimeSetting = (
  child: ChildAttendance,
  field: TimeField,
  currentDate: string,
  canEditTime: boolean
): boolean => {
  if (!canEditTime || !isPastDate(currentDate)) return false

  if (field === 'in') {
    return !child.checked_in_at && (child.status === 'present' || child.status === 'late')
  }

  return !child.checked_out_at && Boolean(child.checked_in_at)
}

/**
 * 楽観的更新: attendanceData を即座に更新する純粋関数
 */
export const applyOptimisticStatusUpdate = (
  data: AttendanceData,
  childId: string,
  nextStatus: 'absent' | 'present',
  currentDate: string
): AttendanceData => {
  const updatedChildren = data.children.map(child => {
    if (child.child_id !== childId) return child

    if (nextStatus === 'absent') {
      return {
        ...child,
        status: 'absent' as const,
        is_expected: false,
        checked_in_at: null,
        checked_out_at: null,
        check_in_method: null,
        is_unexpected: false,
      }
    }

    // nextStatus === 'present'
    // 過去日付: 実際のチェックイン記録を作成するので 'present' を表示
    // 今日/未来: 出席予定にするだけなので '出席予定' バッジ（absent + is_expected=true）
    if (isPastDate(currentDate)) {
      return {
        ...child,
        status: 'present' as const,
        is_expected: true,
      }
    }

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

export type CancelAction = 'cancel_check_in' | 'cancel_check_out'

/**
 * 取り消しボタンの表示判定（施設管理者以上限定、過去日付のみ）
 * @returns 表示すべき取り消しアクションの配列
 */
export const getCancelActions = (child: ChildAttendance, currentDate: string): CancelAction[] => {
  if (!isPastDate(currentDate)) return []

  const actions: CancelAction[] = []

  // 登園取消: 出席/遅刻でチェックイン記録がある場合
  if ((child.status === 'present' || child.status === 'late') && child.checked_in_at) {
    actions.push('cancel_check_in')
  }

  // 降園取消: チェックアウト記録がある場合
  if (child.checked_out_at) {
    actions.push('cancel_check_out')
  }

  return actions
}

/**
 * 楽観的更新: 取り消しアクションを即座にUIに反映する純粋関数
 */
export const applyOptimisticCancelUpdate = (
  data: AttendanceData,
  childId: string,
  cancelAction: CancelAction
): AttendanceData => {
  const updatedChildren = data.children.map(child => {
    if (child.child_id !== childId) return child

    if (cancelAction === 'cancel_check_in') {
      return {
        ...child,
        status: 'absent' as const,
        checked_in_at: null,
        checked_out_at: null,
        check_in_method: null,
        is_unexpected: false,
      }
    }

    // cancel_check_out: チェックアウト情報のみクリア
    return {
      ...child,
      checked_out_at: null,
    }
  })

  const summary = {
    total_children: updatedChildren.length,
    present_count: updatedChildren.filter(c => c.status === 'present').length,
    absent_count: updatedChildren.filter(c => c.status === 'absent').length,
    late_count: updatedChildren.filter(c => c.status === 'late').length,
    not_checked_in_count: updatedChildren.filter(c => c.status === 'not_arrived' && c.is_expected).length,
  }

  return { ...data, children: updatedChildren, summary }
}
