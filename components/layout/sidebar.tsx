"use client"

import type React from "react"

import Image from "next/image"
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
  Tag,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/LogoutButton"

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  roles?: string[] // 指定した場合、そのロールのユーザーにのみ表示
  children?: { label: string; href: string; hidden?: boolean }[]
}

const staffNavItems: NavItem[] = [
  { label: "ダッシュボード", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    label: "記録管理",
    href: "/records",
    icon: <ClipboardList className="h-5 w-5" />,
    children: [
      { label: "記録状況一覧", href: "/records/status" },
      { label: "保育日誌", href: "/records/activity" },
      { label: "記録履歴", href: "/records/activity/history" },
      { label: "児童記録", href: "/records/personal/new" },
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
      { label: "メール送信テスト", href: "/settings/email", hidden: true },
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
      { label: "管理者登録", href: "/admin/company-admins/new" },
    ],
  },
  {
    label: "施設管理",
    href: "/settings/facility",
    icon: <Home className="h-5 w-5" />,
    children: [
      { label: "施設一覧", href: "/settings/facility" },
      { label: "施設登録", href: "/settings/facility/new" },
    ],
  },
  {
    label: "子ども一覧",
    href: "/children",
    icon: <Users className="h-5 w-5" />,
    roles: ["company_admin"],
    children: [
      { label: "子ども一覧", href: "/children" },
    ],
  },
  { label: "タグ管理", href: "/admin/tags", icon: <Tag className="h-5 w-5" />, roles: ["site_admin"] },
  { label: "システムログ", href: "/admin/logs", icon: <Database className="h-5 w-5" /> },
]

type SidebarProps = {
  type: "staff" | "admin"
  role?: string
  userName?: string
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ type, role, userName, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const allNavItems = type === "admin" ? adminNavItems : staffNavItems
  const navItems = allNavItems.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)))

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  /**
   * 子メニュー項目のアクティブ状態を判定する。
   * 同一親メニュー内の兄弟アイテムでより具体的にマッチするものがある場合はそちらを優先する。
   * @param href - メニュー項目のhref
   * @param siblings - 同一親メニュー内の兄弟アイテムのhref配列
   * @returns アクティブ状態かどうか
   */
  const isChildActive = (href: string, siblings: { href: string }[]) => {
    if (pathname === href) return true
    if (!pathname.startsWith(href + "/")) return false
    // 自分よりも具体的にマッチする兄弟がいればfalse
    return !siblings.some(
      (sibling) => sibling.href !== href && (pathname === sibling.href || pathname.startsWith(sibling.href + "/"))
    )
  }

  const handleNavClick = () => {
    onClose?.()
  }

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
          "transition-transform duration-300 ease-in-out",
          "lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
      <div className="border-b border-sidebar-border px-6 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/nobireco-logo.png" alt="のびレコ" width={70} height={48} />
          </div>
          {/* モバイル用閉じるボタン */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="メニューを閉じる"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {userName && (
          <p className="mt-1 text-xs text-muted-foreground truncate" title={userName}>
            {userName}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.label}>
              {item.children ? (
                <div>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground",
                      isActive(item.href) && "bg-sidebar-accent",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </div>
                  <ul className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={handleNavClick}
                          className={cn(
                            "block rounded-lg px-3 py-2 text-sm text-sidebar-foreground",
                            "hover:bg-sidebar-accent active:scale-95 active:bg-sidebar-accent/80 transition-[transform,background-color] duration-150",
                            isChildActive(child.href, item.children ?? []) && "bg-sidebar-accent font-medium",
                            child.hidden && "hidden",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground",
                    "hover:bg-sidebar-accent active:scale-95 active:bg-sidebar-accent/80 transition-[transform,background-color] duration-150",
                    isActive(item.href) && "bg-sidebar-accent font-medium",
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

