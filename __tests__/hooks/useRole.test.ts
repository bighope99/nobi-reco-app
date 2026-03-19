import { renderHook } from "@testing-library/react"
import { useRole } from "@/hooks/useRole"

jest.mock("@/hooks/useSession")
import { useSession } from "@/hooks/useSession"
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

function makeSession(role: string) {
  return {
    user_id: "u1",
    email: "test@example.com",
    name: "Test User",
    role: role as any,
    company_id: null,
    company_name: null,
    facilities: [],
    current_facility_id: null,
    classes: [],
  }
}

describe("useRole", () => {
  it("returns isAdmin=true for site_admin", () => {
    mockUseSession.mockReturnValue(makeSession("site_admin"))
    const { result } = renderHook(() => useRole())
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isFacilityAdmin).toBe(false)
    expect(result.current.isStaff).toBe(false)
  })

  it("returns isAdmin=true for company_admin", () => {
    mockUseSession.mockReturnValue(makeSession("company_admin"))
    const { result } = renderHook(() => useRole())
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isFacilityAdmin).toBe(false)
    expect(result.current.isStaff).toBe(false)
  })

  it("returns isFacilityAdmin=true for facility_admin", () => {
    mockUseSession.mockReturnValue(makeSession("facility_admin"))
    const { result } = renderHook(() => useRole())
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isFacilityAdmin).toBe(true)
    expect(result.current.isStaff).toBe(false)
  })

  it("returns isStaff=true for staff", () => {
    mockUseSession.mockReturnValue(makeSession("staff"))
    const { result } = renderHook(() => useRole())
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isFacilityAdmin).toBe(false)
    expect(result.current.isStaff).toBe(true)
  })

  it("returns all false when session is null", () => {
    mockUseSession.mockReturnValue(null)
    const { result } = renderHook(() => useRole())
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isFacilityAdmin).toBe(false)
    expect(result.current.isStaff).toBe(false)
    expect(result.current.role).toBeNull()
  })

  describe("hasRole", () => {
    it("returns true when role matches", () => {
      mockUseSession.mockReturnValue(makeSession("facility_admin"))
      const { result } = renderHook(() => useRole())
      expect(result.current.hasRole("facility_admin", "site_admin")).toBe(true)
    })

    it("returns false when role does not match", () => {
      mockUseSession.mockReturnValue(makeSession("staff"))
      const { result } = renderHook(() => useRole())
      expect(result.current.hasRole("facility_admin", "site_admin")).toBe(false)
    })

    it("returns false when session is null", () => {
      mockUseSession.mockReturnValue(null)
      const { result } = renderHook(() => useRole())
      expect(result.current.hasRole("staff")).toBe(false)
    })
  })
})
