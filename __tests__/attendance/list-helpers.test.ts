import {
  isPastDate,
  getStatusPresentation,
  getStatusAction,
  applyOptimisticStatusUpdate,
  ChildAttendance,
  AttendanceData,
} from '@/app/attendance/list/helpers'

// テスト用のヘルパー: 基本的なChildAttendanceを生成
const makeChild = (overrides: Partial<ChildAttendance> = {}): ChildAttendance => ({
  child_id: 'child-1',
  name: 'テスト 太郎',
  kana: 'テスト タロウ',
  class_id: 'class-1',
  class_name: 'ひまわり組',
  age_group: '小学1年',
  grade: 1,
  grade_label: '小1',
  photo_url: null,
  status: 'absent',
  is_expected: true,
  checked_in_at: null,
  checked_out_at: null,
  check_in_method: null,
  is_unexpected: false,
  ...overrides,
})

const makeAttendanceData = (children: ChildAttendance[]): AttendanceData => ({
  date: '2026-03-18',
  weekday: 'wednesday',
  weekday_jp: '水',
  summary: {
    total_children: children.length,
    present_count: children.filter(c => c.status === 'present').length,
    absent_count: children.filter(c => c.status === 'absent').length,
    late_count: children.filter(c => c.status === 'late').length,
    not_checked_in_count: children.filter(c => c.status === 'not_arrived' && c.is_expected).length,
  },
  children,
  filters: { classes: [] },
})

// 未来日付（テスト実行時から十分先の日付）
const FUTURE_DATE = '2099-12-31'
// 過去日付
const PAST_DATE = '2020-01-01'

describe('isPastDate', () => {
  it('過去日付に対してtrueを返す', () => {
    expect(isPastDate(PAST_DATE)).toBe(true)
  })

  it('未来日付に対してfalseを返す', () => {
    expect(isPastDate(FUTURE_DATE)).toBe(false)
  })
})

describe('getStatusPresentation', () => {
  describe('未来日付', () => {
    it('出席予定の児童（absent + is_expected）は「出席予定」を返す', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      const result = getStatusPresentation(child, FUTURE_DATE)
      expect(result?.label).toBe('出席予定')
    })

    it('欠席予定の児童（absent + !is_expected）は「欠席予定」を返す', () => {
      const child = makeChild({ status: 'absent', is_expected: false })
      const result = getStatusPresentation(child, FUTURE_DATE)
      expect(result?.label).toBe('欠席予定')
    })

    it('出席済みの児童は「出席」を返す', () => {
      const child = makeChild({ status: 'present' })
      const result = getStatusPresentation(child, FUTURE_DATE)
      expect(result?.label).toBe('出席')
    })

    it('遅刻の児童は「遅刻」を返す', () => {
      const child = makeChild({ status: 'late' })
      const result = getStatusPresentation(child, FUTURE_DATE)
      expect(result?.label).toBe('遅刻')
    })

    it('予定外登園の児童は「予定外登園」を返す', () => {
      const child = makeChild({ status: 'present', is_unexpected: true })
      const result = getStatusPresentation(child, FUTURE_DATE)
      expect(result?.label).toBe('予定外登園')
    })
  })

  describe('過去日付', () => {
    it('出席予定だったが未チェックイン（absent + is_expected）は「欠席」を返す', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      const result = getStatusPresentation(child, PAST_DATE)
      expect(result?.label).toBe('欠席')
    })

    it('欠席予定の児童（absent + !is_expected）は「欠席予定」を返す', () => {
      const child = makeChild({ status: 'absent', is_expected: false })
      const result = getStatusPresentation(child, PAST_DATE)
      expect(result?.label).toBe('欠席予定')
    })
  })
})

describe('getStatusAction', () => {
  describe('未来日付', () => {
    it('出席予定 → 「欠席にする」ボタン', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      expect(getStatusAction(child, FUTURE_DATE)).toBe('absent')
    })

    it('欠席予定 → 「出席にする」ボタン', () => {
      const child = makeChild({ status: 'absent', is_expected: false })
      expect(getStatusAction(child, FUTURE_DATE)).toBe('present')
    })

    it('出席済み → ボタンなし', () => {
      const child = makeChild({ status: 'present' })
      expect(getStatusAction(child, FUTURE_DATE)).toBeNull()
    })

    it('遅刻 → ボタンなし', () => {
      const child = makeChild({ status: 'late' })
      expect(getStatusAction(child, FUTURE_DATE)).toBeNull()
    })
  })

  describe('過去日付', () => {
    it('欠席（is_expected=true）→ 「出席にする」ボタンが表示される', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      expect(getStatusAction(child, PAST_DATE)).toBe('present')
    })

    it('出席済み → 「欠席にする」ボタンが表示される', () => {
      const child = makeChild({ status: 'present' })
      expect(getStatusAction(child, PAST_DATE)).toBe('absent')
    })

    it('遅刻 → 「欠席にする」ボタンが表示される', () => {
      const child = makeChild({ status: 'late' })
      expect(getStatusAction(child, PAST_DATE)).toBe('absent')
    })

    it('欠席予定（is_expected=false）→ 「出席にする」ボタンが表示される', () => {
      const child = makeChild({ status: 'absent', is_expected: false })
      expect(getStatusAction(child, PAST_DATE)).toBe('present')
    })
  })
})

describe('applyOptimisticStatusUpdate', () => {
  it('出席予定の児童を欠席にすると、summary.absent_countが増える', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: true }),
      makeChild({ child_id: 'child-2', status: 'present' }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'absent')

    expect(result.children[0].status).toBe('absent')
    expect(result.children[0].is_expected).toBe(false)
    expect(result.summary.absent_count).toBe(1)
    expect(result.summary.present_count).toBe(1)
  })

  it('欠席予定の児童を出席にすると、is_expectedがtrueになる', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: false }),
      makeChild({ child_id: 'child-2', status: 'present' }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'present')

    expect(result.children[0].is_expected).toBe(true)
    // 実際のステータスはAPIのレスポンス後に確定するが、
    // 楽観的更新ではis_expectedをtrueにしてstatusは'absent'のまま（出席予定表示）
    expect(result.children[0].status).toBe('absent')
    expect(result.summary.absent_count).toBe(1)
  })

  it('対象外の児童は変更されない', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: true }),
      makeChild({ child_id: 'child-2', status: 'present' }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'absent')

    expect(result.children[1].status).toBe('present')
    expect(result.children[1].child_id).toBe('child-2')
  })

  it('summaryが正しく再計算される', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'present' }),
      makeChild({ child_id: 'child-2', status: 'present' }),
      makeChild({ child_id: 'child-3', status: 'absent', is_expected: true }),
    ]
    const data = makeAttendanceData(children)
    expect(data.summary.present_count).toBe(2)
    expect(data.summary.absent_count).toBe(1)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'absent')

    expect(result.summary.present_count).toBe(1)
    expect(result.summary.absent_count).toBe(2)
  })
})
