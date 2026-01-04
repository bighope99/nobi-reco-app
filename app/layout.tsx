import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

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
    <html lang="ja" className="h-full">
      <body className="h-full font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
