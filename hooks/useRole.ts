"use client"

import { useSession } from "@/hooks/useSession"

export function useRole() {
  const session = useSession()
  const role = session?.role ?? null

  return {
    role,
    isAdmin: role === "site_admin" || role === "company_admin",
    isFacilityAdmin: role === "facility_admin",
    isStaff: role === "staff",
    hasRole: (...roles: string[]) => (role ? roles.includes(role) : false),
  }
}
