/**
 * 一括作成ボタンのテスト
 * #170 一括作成が機能しない - ボタンクリックで /records/activity に遷移すること
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

jest.mock("@/components/layout/staff-layout", () => ({
  StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/lib/ai/childIdFormatter", () => ({
  replaceChildIdsWithNames: (text: string) => text,
}))

jest.mock("@/lib/utils/timezone", () => ({
  getCurrentDateJST: () => "2026-03-09",
}))

// fetchのモック - 記録状況データを返す
const mockRecordsData = {
  success: true,
  data: {
    period: { year: 2026, month: 3, start_date: "2026-03-01", end_date: "2026-03-31", days_in_month: 31 },
    children: [],
    summary: { total_children: 0, warning_children: 0, average_record_rate: 0 },
    filters: { classes: [] },
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockRecordsData),
  })
})

import StatusPage from "../page"

describe("記録状況一覧 - 一括作成ボタン", () => {
  it("一括作成ボタンが /records/activity へのリンクであること", async () => {
    render(<StatusPage />)

    // データ読み込み完了を待つ
    const bulkCreateLink = await screen.findByText("一括作成")
    expect(bulkCreateLink).toBeDefined()

    // リンク先が /records/activity であること
    const linkElement = bulkCreateLink.closest("a")
    expect(linkElement).not.toBeNull()
    expect(linkElement?.getAttribute("href")).toBe("/records/activity")
  })
})
