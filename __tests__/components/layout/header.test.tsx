import React from "react"
import { render, screen } from "@testing-library/react"
import { Header } from "@/components/layout/header"

// Mock LogoutButton
jest.mock("@/components/LogoutButton", () => ({
  LogoutButton: (props: Record<string, unknown>) => <button {...props}>ログアウト</button>,
}))

describe("Header", () => {
  it("does not render notification bell when SHOW_NOTIFICATIONS is false", () => {
    render(<Header title="テスト" />)

    const bellButton = screen.queryByLabelText("通知")
    expect(bellButton).not.toBeInTheDocument()
  })

  it("renders title correctly", () => {
    render(<Header title="安全管理ダッシュボード" />)

    expect(screen.getByText("安全管理ダッシュボード")).toBeInTheDocument()
  })

  it("renders facility name when provided", () => {
    render(<Header title="テスト" facilityName="テスト施設" />)

    expect(screen.getByText("テスト施設")).toBeInTheDocument()
  })
})
