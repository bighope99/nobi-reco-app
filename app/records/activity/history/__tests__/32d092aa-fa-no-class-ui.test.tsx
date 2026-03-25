/**
 * #32d092aa-fa: クラスがない施設でもクラス表示が出ている
 * クラスが存在しない場合、クラス選択UIとクラス列が表示されないことを確認する
 */
import { render, screen } from "@testing-library/react"

const mockReplace = jest.fn()
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/records/activity/history",
  useSearchParams: () => ({
    get: () => null,
    toString: () => "",
  }),
}))

jest.mock("@/hooks/useDebounce", () => ({
  useDebounce: (value: unknown) => value,
}))

jest.mock("@/components/layout/staff-layout", () => ({
  StaffLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("../../../_components/history-tabs", () => ({
  HistoryTabs: () => null,
}))

// クラスなし・スタッフなしのfetchモック
global.fetch = jest.fn((url: string) => {
  if (url.includes("/api/classes")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { classes: [] } }),
    } as Response)
  }
  if (url.includes("/api/users")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { users: [] } }),
    } as Response)
  }
  if (url.includes("/api/activities")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { activities: [], total: 0, has_more: false } }),
    } as Response)
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  } as Response)
}) as jest.Mock

import ActivityHistoryClient from "../activity-history-client"

describe("#32d092aa-fa クラスなし施設でのUI非表示", () => {
  it("クラスがない場合、クラスフィルターが表示されない", async () => {
    render(<ActivityHistoryClient />)
    // クラスラベルが存在しないことを確認
    const classLabel = screen.queryByText("クラス")
    expect(classLabel).toBeNull()
  })
})
