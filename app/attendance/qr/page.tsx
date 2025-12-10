'use client';

import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"

interface QRData {
  token: string
  qr_code_svg: string
  facility_id: string
  issued_at: string
  expires_at: string
  expires_in_minutes: number
}

export default function QRAttendancePage() {
  const [qrData, setQrData] = useState<QRData | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  const generateQR = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/attendance/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_minutes: 30 }),
      })
      const result = await response.json()
      if (result.success) {
        setQrData(result.data)
      } else {
        alert('QRコード生成に失敗しました')
      }
    } catch (error) {
      console.error('QR generation error:', error)
      alert('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // Calculate time remaining
  useEffect(() => {
    if (!qrData) return

    const interval = setInterval(() => {
      const now = new Date()
      const expiresAt = new Date(qrData.expires_at)
      const diff = expiresAt.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining('期限切れ')
        clearInterval(interval)
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${minutes}分${seconds}秒`)
    }, 1000)

    return () => clearInterval(interval)
  }, [qrData])

  // Auto-generate on mount
  useEffect(() => {
    generateQR()
  }, [])

  return (
    <StaffLayout title="QR出欠" subtitle="QRコードで出席確認">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">出席確認QRコード</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrData ? (
              <>
                <div
                  className="flex items-center justify-center rounded-lg border-2 border-border bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: qrData.qr_code_svg }}
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">このQRコードをスキャンして出席を記録します</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    残り時間: {timeRemaining}
                  </p>
                </div>
                <Button
                  onClick={generateQR}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  QRコードを再生成
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <p className="text-muted-foreground">読み込み中...</p>
                <Button onClick={generateQR} disabled={loading}>
                  QRコードを生成
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
