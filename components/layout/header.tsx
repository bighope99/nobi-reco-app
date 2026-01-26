"use client"

import { Bell, User, Menu, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/LogoutButton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "@/hooks/useSession"

type HeaderProps = {
  title: string
  subtitle?: string
  onMenuClick?: () => void
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const session = useSession()

  // 現在の施設名を取得
  const currentFacility = session?.facilities.find(
    f => f.facility_id === session.current_facility_id
  )
  const facilityName = currentFacility?.facility_name
  const userName = session?.name

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-4">
        {/* モバイル用ハンバーガーメニュー */}
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden"
            aria-label="メニューを開く"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-card-foreground">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {/* 施設名表示 */}
        {facilityName && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="truncate max-w-[200px]">{facilityName}</span>
          </div>
        )}
        <Button variant="ghost" size="icon" className="hidden sm:flex">
          <Bell className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>アカウント情報</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {userName && (
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{userName}</span>
              </DropdownMenuItem>
            )}
            {facilityName && (
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="truncate">{facilityName}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <LogoutButton variant="ghost" size="sm" className="hidden sm:flex" />
        {/* モバイル用ログアウトボタン（アイコンのみ） */}
        <LogoutButton variant="ghost" size="icon" className="sm:hidden" />
      </div>
    </header>
  )
}
