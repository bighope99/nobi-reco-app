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
  name: 'テスト太郎',
  kana: 'てすとたろう',
  class_id: 'class-1',
  class_name: 'ひまわり組',
  age_group: 'elementary',
  grade: 1,
  grade_label: '1年生',
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

// 過去日付
const PAST_DATE = '2020-01-01'
// 固定日付（テストの再現性を保証する）
const FIXED_NOW = new Date('2026-03-18T10:00:00Z')
const TODAY = FIXED_NOW.toISOString().split('T')[0]
// 未来日付
const FUTURE_DATE = '2099-12-31'

describe('isPastDate', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    // JST 2026-03-18 = UTC 2026-03-17T15:00:00Z 以降
    // テストで「今日 = 2026-03-18 JST」を保証するため UTC+9 相当の時刻を使用
    jest.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('過去の日付は true を返す', () => {
    expect(isPastDate(PAST_DATE)).toBe(true)
  })

  it('今日の日付は false を返す', () => {
    expect(isPastDate(TODAY)).toBe(false)
  })

  it('未来の日付は false を返す', () => {
    expect(isPastDate(FUTURE_DATE)).toBe(false)
  })
})

describe('getStatusPresentation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('今日の日付', () => {
    it('absent + is_expected=true → label: 出席予定', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      const result = getStatusPresentation(child, TODAY)
      expect(result?.label).toBe('出席予定')
    })

    it('absent + is_expected=false → label: 欠席予定', () => {
      const child = makeChild({ status: 'absent', is_expected: false })
      const result = getStatusPresentation(child, TODAY)
      expect(result?.label).toBe('欠席予定')
    })

    it('present → label: 出席', () => {
      const child = makeChild({ status: 'present' })
      const result = getStatusPresentation(child, TODAY)
      expect(result?.label).toBe('出席')
    })

    it('late → label: 遅刻', () => {
      const child = makeChild({ status: 'late' })
      const result = getStatusPresentation(child, TODAY)
      expect(result?.label).toBe('遅刻')
    })

    it('is_unexpected=true → label: 予定外登園', () => {
      const child = makeChild({ status: 'present', is_unexpected: true })
      const result = getStatusPresentation(child, TODAY)
      expect(result?.label).toBe('予定外登園')
    })
  })

  describe('過去日付', () => {
    it('absent + is_expected=true の過去日付 → label: 欠席', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      const result = getStatusPresentation(child, PAST_DATE)
      expect(result?.label).toBe('欠席')
    })

    it('absent + is_expected=true の今日 → label: 出席予定', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      const result = getStatusPresentation(child, TODAY)
      expect(result?.label).toBe('出席予定')
    })

    it('absent + is_expected=false の過去日付 → label: 欠席', () => {
      const child = makeChild({ status: 'absent', is_expected: false })
      const result = getStatusPresentation(child, PAST_DATE)
      expect(result?.label).toBe('欠席')
    })
  })
})

describe('getStatusAction', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('今日の動作', () => {
    it('status=absent, is_expected=true → absent（欠席にするボタン）', () => {
      // 今日: 出席予定 → 欠席にするアクション
      const child = makeChild({ status: 'absent', is_expected: true })
      expect(getStatusAction(child, TODAY)).toBe('absent')
    })

    it('status=absent, is_expected=false → present（出席にするボタン）', () => {
      // 今日: 欠席予定 → 出席にするアクション
      const child = makeChild({ status: 'absent', is_expected: false })
      expect(getStatusAction(child, TODAY)).toBe('present')
    })

    it('status=present, is_expected=true → null（ボタンなし）', () => {
      const child = makeChild({ status: 'present', is_expected: true })
      expect(getStatusAction(child, TODAY)).toBeNull()
    })

    it('status=late, is_expected=true → null（ボタンなし）', () => {
      const child = makeChild({ status: 'late', is_expected: true })
      expect(getStatusAction(child, TODAY)).toBeNull()
    })
  })

  describe('過去日付の動作', () => {
    it('status=absent, is_expected=true → present（欠席 → 出席にする）', () => {
      const child = makeChild({ status: 'absent', is_expected: true })
      expect(getStatusAction(child, PAST_DATE)).toBe('present')
    })

    it('status=present, is_expected=true → absent（出席 → 欠席にする）', () => {
      const child = makeChild({ status: 'present', is_expected: true })
      expect(getStatusAction(child, PAST_DATE)).toBe('absent')
    })

    it('status=late, is_expected=true → absent（遅刻 → 欠席にする）', () => {
      const child = makeChild({ status: 'late', is_expected: true })
      expect(getStatusAction(child, PAST_DATE)).toBe('absent')
    })

    it('status=absent, is_expected=false → present（欠席予定 → 出席にする）', () => {
      // 欠席予定ラベルは isPast に関係なく present を返す
      const child = makeChild({ status: 'absent', is_expected: false })
      expect(getStatusAction(child, PAST_DATE)).toBe('present')
    })
  })
})

describe('applyOptimisticStatusUpdate', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const PAST = '2020-01-01'

  it('出席予定の児童を欠席にすると summary.absent_count が増える', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: true }),
      makeChild({ child_id: 'child-2', status: 'present' }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'absent', TODAY)

    expect(result.children[0].status).toBe('absent')
    expect(result.children[0].is_expected).toBe(false)
    expect(result.summary.absent_count).toBe(1)
    expect(result.summary.present_count).toBe(1)
  })

  it('今日: 欠席予定の児童を出席にすると is_expected が true になり status は absent のまま（出席予定表示）', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: false }),
      makeChild({ child_id: 'child-2', status: 'present' }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'present', TODAY)

    expect(result.children[0].is_expected).toBe(true)
    // 今日: is_expected=true に変更、status は absent のまま（出席予定バッジ）
    expect(result.children[0].status).toBe('absent')
    expect(result.summary.absent_count).toBe(1)
  })

  it('過去日付: 出席にすると status が present になる（出席バッジ）', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: true }),
      makeChild({ child_id: 'child-2', status: 'absent', is_expected: false }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'present', PAST)

    expect(result.children[0].status).toBe('present')
    expect(result.children[0].is_expected).toBe(true)
    expect(result.summary.present_count).toBe(1)
    expect(result.summary.absent_count).toBe(1)
  })

  it('対象外の児童は変更されない', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'absent', is_expected: true }),
      makeChild({ child_id: 'child-2', status: 'present' }),
    ]
    const data = makeAttendanceData(children)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'absent', TODAY)

    expect(result.children[1].status).toBe('present')
    expect(result.children[1].child_id).toBe('child-2')
  })

  it('summary が正しく再計算される', () => {
    const children = [
      makeChild({ child_id: 'child-1', status: 'present' }),
      makeChild({ child_id: 'child-2', status: 'present' }),
      makeChild({ child_id: 'child-3', status: 'absent', is_expected: true }),
    ]
    const data = makeAttendanceData(children)
    expect(data.summary.present_count).toBe(2)
    expect(data.summary.absent_count).toBe(1)

    const result = applyOptimisticStatusUpdate(data, 'child-1', 'absent', TODAY)

    expect(result.summary.present_count).toBe(1)
    expect(result.summary.absent_count).toBe(2)
  })
})
