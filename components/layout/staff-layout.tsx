"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { useSession } from "@/hooks/useSession"

type StaffLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function StaffLayout({ children, title, subtitle }: StaffLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const session = useSession()

  // セッションから情報を取得（1箇所で取得し、子コンポーネントにpropsで渡す）
  const userName = session?.name
  const currentFacility = session?.facilities.find(
    f => f.facility_id === session.current_facility_id
  )
  const facilityName = currentFacility?.facility_name

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        type="staff"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        userName={userName}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setIsSidebarOpen(true)}
          userName={userName}
          facilityName={facilityName}
        />
        <main id="staff-layout-main" className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 scroll-smooth">{children}</main>
      </div>
    </div>
  )
}
