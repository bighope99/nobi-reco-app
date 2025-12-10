"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ClipboardList,
  UserCheck,
  Users,
  Settings,
  Database,
  Building2,
  Home,
  ChevronDown,
} from "lucide-react"
import { useState } from "react"
import { LogoutButton } from "@/components/LogoutButton"

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  children?: { label: string; href: string }[]
}

const staffNavItems: NavItem[] = [
  { label: "ダッシュボード", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    label: "記録管理",
    href: "/records",
    icon: <ClipboardList className="h-5 w-5" />,
    children: [
      { label: "記録状況一覧", href: "/records/status" },
      { label: "活動記録入力", href: "/records/activity" },
    ],
  },
  {
    label: "出席管理",
    href: "/attendance",
    icon: <UserCheck className="h-5 w-5" />,
    children: [
      { label: "出席予定登録", href: "/attendance/schedule" },
      { label: "QR出欠", href: "/attendance/qr" },
      { label: "出席児童一覧", href: "/attendance/list" },
    ],
  },
  {
    label: "子ども管理",
    href: "/children",
    icon: <Users className="h-5 w-5" />,
    children: [
      { label: "子ども一覧", href: "/children" },
      { label: "新規登録", href: "/children/new" },
      { label: "CSV一括登録", href: "/children/import" },
    ],
  },
  {
    label: "施設設定",
    href: "/settings",
    icon: <Settings className="h-5 w-5" />,
    children: [
      { label: "施設情報", href: "/settings/facility" },
      { label: "クラス管理", href: "/settings/classes" },
      { label: "通所設定", href: "/settings/schedules" },
      { label: "職員管理", href: "/settings/users" },
    ],
  },
  { label: "データ管理", href: "/data/export", icon: <Database className="h-5 w-5" /> },
]

const adminNavItems: NavItem[] = [
  { label: "管理者TOP", href: "/admin", icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    label: "会社管理",
    href: "/admin/companies",
    icon: <Building2 className="h-5 w-5" />,
    children: [
      { label: "会社一覧", href: "/admin/companies" },
      { label: "会社登録", href: "/admin/companies/new" },
    ],
  },
  {
    label: "施設管理",
    href: "/admin/facilities",
    icon: <Home className="h-5 w-5" />,
    children: [
      { label: "施設一覧", href: "/admin/facilities" },
      { label: "施設登録", href: "/admin/facilities/new" },
    ],
  },
  { label: "ユーザー管理", href: "/admin/users", icon: <Users className="h-5 w-5" /> },
  { label: "システムログ", href: "/admin/logs", icon: <Database className="h-5 w-5" /> },
]

type SidebarProps = {
  type: "staff" | "admin"
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ type, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const navItems = type === "admin" ? adminNavItems : staffNavItems
  const [openMenus, setOpenMenus] = useState<string[]>([])

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]))
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <>
      {/* モバイル用バックドロップ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* サイドバー本体 */}
      <aside className={cn(
        "flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar",
        // モバイル: オーバーレイとして表示
        "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          の
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">のびレコ</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                      isActive(item.href) && "bg-sidebar-accent",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon}
                      {item.label}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", openMenus.includes(item.label) && "rotate-180")}
                    />
                  </button>
                  {openMenus.includes(item.label) && (
                    <ul className="ml-8 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "block rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                              pathname === child.href && "bg-sidebar-accent font-medium",
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent",
                    pathname === item.href && "bg-sidebar-accent font-medium",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <LogoutButton
          variant="ghost"
          size="default"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        />
      </div>
      </aside>
    </>
  )
}
