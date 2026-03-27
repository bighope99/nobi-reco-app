import type React from "react"
import type { Metadata } from "next"
import { Noto_Sans_JP } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import { SessionGuard } from "@/components/auth/session-guard"
import "./globals.css"

const notoSansJp = Noto_Sans_JP({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
})

// <CHANGE> のびレコ用メタデータ
export const metadata: Metadata = {
  title: "のびレコ - 子どもの成長記録アプリ",
  description: "子どもの「のびしろ」を見える化する記録・評価アプリ",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`h-full ${notoSansJp.className}`}>
      <body className="h-full font-sans antialiased">
        <SessionGuard />
        {children}
        <Analytics />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
