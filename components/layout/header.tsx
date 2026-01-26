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

type HeaderProps = {
  title: string
  subtitle?: string
  onMenuClick?: () => void
  userName?: string
  facilityName?: string
}

export function Header({ title, subtitle, onMenuClick, userName, facilityName }: HeaderProps) {

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
        {/* 施設名表示（デスクトップ） */}
        {facilityName && (
          <div
            className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground"
            role="status"
            aria-label={`現在の施設: ${facilityName}`}
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span className="truncate max-w-[200px]">{facilityName}</span>
          </div>
        )}
        <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="通知">
          <Bell className="h-5 w-5" />
        </Button>
        {/* ユーザーメニュー（デスクトップ） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="アカウントメニュー">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>アカウント情報</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {userName && (
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <User className="h-4 w-4" aria-hidden="true" />
                <span>{userName}</span>
              </DropdownMenuItem>
            )}
            {facilityName && (
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{facilityName}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <LogoutButton variant="ghost" size="sm" className="hidden sm:flex" />
        {/* モバイル用：ユーザーメニュー（施設名・ユーザー名・ログアウト） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden" aria-label="メニュー">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>アカウント情報</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {userName && (
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <User className="h-4 w-4" aria-hidden="true" />
                <span>{userName}</span>
              </DropdownMenuItem>
            )}
            {facilityName && (
              <DropdownMenuItem disabled className="flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                <span className="truncate">{facilityName}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <LogoutButton variant="ghost" size="sm" className="w-full justify-start" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
