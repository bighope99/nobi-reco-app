import type React from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"

type StaffLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export function StaffLayout({ children, title, subtitle }: StaffLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar type="staff" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  )
}
