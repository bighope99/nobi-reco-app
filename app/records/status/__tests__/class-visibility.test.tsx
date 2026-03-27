/**
 * クラスがない施設でクラス関連UIが非表示になることをテスト
 * チケット: クラスがないときはクラス表示を非表示に
 */
import { render, screen } from "@testing-library/react"

// モック
const mockPush = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("next/link", () => {
  return function MockLink({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>
  }
})

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => {
    if (asChild) return <>{children}</>
    return <button {...props}>{children}</button>
  },
}))

jest.mock("@/components/layout/staff-layout", () => ({
  StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/lib/ai/childIdFormatter", () => ({
  replaceChildIdsWithNames: (text: string) => text,
}))

jest.mock("@/lib/utils/timezone", () => ({
  getCurrentDateJST: () => "2026-03-09",
}))

// --- テストデータ ---
const baseChild = {
  child_id: "child-1",
  name: "山田 太郎",
  kana: "ヤマダ タロウ",
  class_id: null,
  class_name: "",
  age_group: "",
  grade: 1,
  grade_label: "小1",
  photo_url: null,
  last_record_date: "2026-03-08",
  is_recorded_today: false,
  monthly: { attendance_count: 10, record_count: 8, record_rate: 80, daily_status: [] },
  yearly: { attendance_count: 100, record_count: 80, record_rate: 80 },
}

const basePeriod = { year: 2026, month: 3, start_date: "2026-03-01", end_date: "2026-03-31", days_in_month: 31 }
const baseHeatmap = { mode: "recent30", start_date: "2026-02-07", end_date: "2026-03-09", days: 30 }
const baseSummary = { total_children: 1, warning_children: 0, average_record_rate: 80 }

function makeResponse(classes: Array<{ class_id: string; class_name: string }>, children = [baseChild]) {
  return {
    success: true,
    data: {
      period: basePeriod,
      heatmap: baseHeatmap,
      children,
      summary: baseSummary,
      filters: { classes },
    },
  }
}

import StatusPage from "../page"

describe("記録状況一覧 - クラス表示の条件分岐", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("クラスが存在しない施設", () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeResponse([])),
      })
    })

    it("クラスフィルターが表示されないこと", async () => {
      render(<StatusPage />)
      await screen.findByText("山田 太郎")

      // 「全クラス」の選択肢が存在しないこと
      expect(screen.queryByText("全クラス")).toBeNull()
    })

    it("テーブルヘッダーが「学年」と表示されること", async () => {
      render(<StatusPage />)
      await screen.findByText("山田 太郎")

      // 「学年」が表示されること
      const headers = screen.getAllByRole("columnheader")
      const gradeHeader = headers.find(h => h.textContent?.includes("学年"))
      expect(gradeHeader).toBeDefined()
      expect(gradeHeader?.textContent).not.toContain("クラス")
    })

    it("テーブルセルにクラス名が表示されないこと", async () => {
      const childWithClass = { ...baseChild, class_name: "ひまわり組" }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeResponse([], [childWithClass])),
      })

      render(<StatusPage />)
      await screen.findByText("山田 太郎")

      // class_name が描画されないこと
      expect(screen.queryByText("ひまわり組")).toBeNull()
    })
  })

  describe("クラスが存在する施設", () => {
    const classes = [
      { class_id: "cls-1", class_name: "ひまわり組" },
      { class_id: "cls-2", class_name: "さくら組" },
    ]

    beforeEach(() => {
      const childWithClass = { ...baseChild, class_id: "cls-1", class_name: "ひまわり組" }
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeResponse(classes, [childWithClass])),
      })
    })

    it("クラスフィルターが表示されること", async () => {
      render(<StatusPage />)
      await screen.findByText("山田 太郎")

      expect(screen.getByText("全クラス")).toBeDefined()
      // ひまわり組はフィルターとテーブルセルの両方に表示される
      expect(screen.getAllByText("ひまわり組").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("さくら組")).toBeDefined()
    })

    it("テーブルヘッダーが「学年・クラス」と表示されること", async () => {
      render(<StatusPage />)
      await screen.findByText("山田 太郎")

      const headers = screen.getAllByRole("columnheader")
      const gradeHeader = headers.find(h => h.textContent?.includes("学年"))
      expect(gradeHeader).toBeDefined()
      expect(gradeHeader?.textContent).toContain("学年・クラス")
    })

    it("テーブルセルにクラス名が表示されること", async () => {
      render(<StatusPage />)
      // findAllByText because "ひまわり組" appears in both filter and cell
      const elements = await screen.findAllByText("ひまわり組")
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })
})
