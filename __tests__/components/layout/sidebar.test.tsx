import React from "react"
import { render, screen } from "@testing-library/react"
import { Sidebar } from "@/components/layout/sidebar"

// Mock next/navigation
const mockPathname = jest.fn()
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}))

describe("Sidebar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/dashboard")
  })

  describe("active state based on pathname", () => {
    it("highlights dashboard when pathname is /dashboard", () => {
      mockPathname.mockReturnValue("/dashboard")
      render(<Sidebar type="staff" />)

      const dashboardLink = screen.getByRole("link", { name: "ダッシュボード" })
      expect(dashboardLink).toHaveClass("bg-sidebar-accent")
    })

    it("does not highlight dashboard when pathname is /records", () => {
      mockPathname.mockReturnValue("/records/status")
      render(<Sidebar type="staff" />)

      const dashboardLink = screen.getByRole("link", { name: "ダッシュボード" })
      expect(dashboardLink).not.toHaveClass("bg-sidebar-accent")
    })

    it("highlights child item when pathname exactly matches child href", () => {
      mockPathname.mockReturnValue("/records/activity")
      render(<Sidebar type="staff" />)

      const activityLink = screen.getByRole("link", { name: "保育日誌" })
      expect(activityLink).toHaveClass("bg-sidebar-accent")
    })

    it("highlights the correct child when pathname is a sub-path", () => {
      mockPathname.mockReturnValue("/records/personal/new")
      render(<Sidebar type="staff" />)

      const personalLink = screen.getByRole("link", { name: "児童記録" })
      expect(personalLink).toHaveClass("bg-sidebar-accent")
    })

    it("highlights '子ども一覧' only when pathname is exactly /children", () => {
      mockPathname.mockReturnValue("/children")
      render(<Sidebar type="staff" />)

      const childrenLink = screen.getByRole("link", { name: "子ども一覧" })
      expect(childrenLink).toHaveClass("bg-sidebar-accent")
    })

    it("does not highlight '子ども一覧' when pathname is /children/new", () => {
      mockPathname.mockReturnValue("/children/new")
      render(<Sidebar type="staff" role="facility_admin" />)

      const childrenLink = screen.getByRole("link", { name: "子ども一覧" })
      expect(childrenLink).not.toHaveClass("bg-sidebar-accent")

      const newChildLink = screen.getByRole("link", { name: "新規登録" })
      expect(newChildLink).toHaveClass("bg-sidebar-accent")
    })

    it("highlights '子ども一覧' when pathname is /children/[id] (child detail)", () => {
      mockPathname.mockReturnValue("/children/some-uuid-123")
      render(<Sidebar type="staff" />)

      // 子ども詳細は「子ども一覧」配下なのでアクティブにする
      const childrenLink = screen.getByRole("link", { name: "子ども一覧" })
      expect(childrenLink).toHaveClass("bg-sidebar-accent")
    })

    it("highlights parent menu label when any child is active", () => {
      mockPathname.mockReturnValue("/records/activity")
      render(<Sidebar type="staff" />)

      const recordsLabel = screen.getByText("記録管理").closest("div")
      expect(recordsLabel).toHaveClass("bg-sidebar-accent")
    })

    it("does not highlight '会社一覧' when pathname is /admin/companies/new", () => {
      mockPathname.mockReturnValue("/admin/companies/new")
      render(<Sidebar type="admin" role="site_admin" />)

      const companiesLink = screen.getByRole("link", { name: "会社一覧" })
      expect(companiesLink).not.toHaveClass("bg-sidebar-accent")

      const newCompanyLink = screen.getByRole("link", { name: "会社登録" })
      expect(newCompanyLink).toHaveClass("bg-sidebar-accent")
    })

    it("shows '会社情報' menu for company_admin with companyId", () => {
      mockPathname.mockReturnValue("/admin")
      render(<Sidebar type="admin" role="company_admin" companyId="test-company-id" />)

      const companyInfoLink = screen.getByRole("link", { name: "会社情報" })
      expect(companyInfoLink).toBeInTheDocument()
      expect(companyInfoLink).toHaveAttribute("href", "/admin/companies/test-company-id")
    })

    it("does not show '会社情報' menu for site_admin", () => {
      mockPathname.mockReturnValue("/admin")
      render(<Sidebar type="admin" role="site_admin" />)

      expect(screen.queryByRole("link", { name: "会社情報" })).not.toBeInTheDocument()
    })

    it("auto-opens parent menu containing the active child", () => {
      mockPathname.mockReturnValue("/settings/classes")
      render(<Sidebar type="staff" role="facility_admin" />)

      // The child item should be visible (parent menu is open)
      const classesLink = screen.getByRole("link", { name: "クラス管理" })
      expect(classesLink).toBeInTheDocument()
      expect(classesLink).toHaveClass("bg-sidebar-accent")
    })
  })
})
