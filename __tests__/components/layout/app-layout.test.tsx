import { getSidebarType } from "@/components/layout/app-layout"

describe("getSidebarType", () => {
  it("returns 'admin' for site_admin", () => {
    expect(getSidebarType("site_admin")).toBe("admin")
  })

  it("returns 'admin' for company_admin", () => {
    expect(getSidebarType("company_admin")).toBe("admin")
  })

  it("returns 'staff' for facility_admin", () => {
    expect(getSidebarType("facility_admin")).toBe("staff")
  })

  it("returns 'staff' for staff", () => {
    expect(getSidebarType("staff")).toBe("staff")
  })

  it("returns 'staff' for undefined", () => {
    expect(getSidebarType(undefined)).toBe("staff")
  })

  it("returns 'staff' for null", () => {
    expect(getSidebarType(null)).toBe("staff")
  })
})
