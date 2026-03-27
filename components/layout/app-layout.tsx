"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { useSession } from "@/hooks/useSession"

type AppLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function getSidebarType(role?: string | null): "staff" | "admin" {
  return role === "site_admin" || role === "company_admin" ? "admin" : "staff"
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const session = useSession()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const userName = session?.name
  const currentFacility = session?.facilities.find(
    f => f.facility_id === session.current_facility_id
  )
  const facilityName = currentFacility?.facility_name
  const sidebarType = getSidebarType(session?.role)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        type={sidebarType}
        role={session?.role ?? undefined}
        companyId={session?.company_id ?? undefined}
        userName={userName}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          userName={userName}
          facilityName={facilityName}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
