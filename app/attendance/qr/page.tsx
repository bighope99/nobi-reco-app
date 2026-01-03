'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Check, Loader2, TriangleAlert, VideoOff } from "lucide-react"
import { BrowserQRCodeReader } from "@zxing/browser"

import { StaffLayout } from "@/components/layout/staff-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface AttendanceQrPayload {
  type: string
  child_id: string
  facility_id: string
  signature: string
}

type ScanStatus = "idle" | "starting" | "scanning" | "stopped"

interface CheckInResult {
  success: boolean
  data?: {
    child_id: string
    child_name: string
    class_name: string
    checked_in_at: string
    attendance_date: string
  }
  error?: string
}

export default function QRAttendanceScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)

  const stopScanner = useCallback(async () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop()
      } catch (error) {
        console.error("Error stopping code reader", error)
      }
      controlsRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    codeReaderRef.current = null
    setScanStatus("stopped")
  }, [])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [stopScanner])

  const parsePayload = (raw: string): AttendanceQrPayload | null => {
    try {
      const parsed = JSON.parse(raw) as AttendanceQrPayload
      if (parsed.type !== "attendance") return null
      if (!parsed.child_id || !parsed.facility_id || !parsed.signature) return null
      return parsed
    } catch (error) {
      console.error("QR parse error", error)
      return null
    }
  }

  const handleCheckIn = async (payload: AttendanceQrPayload) => {
    setIsCheckingIn(true)
    setCheckInResult(null)

    try {
      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: payload.signature,
          child_id: payload.child_id,
        }),
      })

      const result: CheckInResult = await response.json()
      setCheckInResult(result)
    } catch (error) {
      console.error('Check-in error:', error)
      setCheckInResult({
        success: false,
        error: 'チェックイン処理中にエラーが発生しました',
      })
    } finally {
      setIsCheckingIn(false)
    }
  }

  const processDetection = (rawValue: string) => {
    const payload = parsePayload(rawValue)
    if (payload) {
      // QR読取り後、自動的に出席記録を行う
      handleCheckIn(payload)
    } else {
      setCheckInResult({
        success: false,
        error: 'QRコードの形式が正しくありません',
      })
    }
  }

  const startScanner = useCallback(async () => {
    setErrorMessage(null)
    setScanStatus("starting")

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("この端末ではカメラを利用できません。別の端末またはブラウザでお試しください。")
      setScanStatus("idle")
      return
    }

    await stopScanner()

    try {
      if (!videoRef.current) {
        throw new Error("ビデオ要素が見つかりません")
      }

      // ZXingのBrowserQRCodeReaderを初期化
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserQRCodeReader()
      }

      // カメラストリームを取得してビデオ要素に設定
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      videoRef.current.srcObject = stream

      try {
        await videoRef.current.play()
      } catch (playError) {
        console.error("Video play error", playError)
        throw new Error("カメラ映像の再生に失敗しました。ブラウザの権限設定を確認してください。")
      }

      setScanStatus("scanning")

      // ZXingでQRコードを読み取り開始
      // undefinedを渡すとデフォルトのカメラ（背面カメラ優先）を使用
      const controls = await codeReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            processDetection(result.getText())
          } else if (error && error.name !== "NotFoundException") {
            // NotFoundExceptionはQRコードが見つからないだけなので無視
            console.error("QR code decode error", error)
          }
        }
      )

      controlsRef.current = controls
    } catch (error) {
      console.error("Camera start error", error)
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("カメラへのアクセスが拒否されました。ブラウザの許可設定を確認してください。")
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        setErrorMessage("カメラデバイスが検出できませんでした。接続を確認して再度お試しください。")
      } else if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage("カメラの起動に失敗しました。ブラウザの権限設定を確認してください。")
      }
      await stopScanner()
      setScanStatus("idle")
    }
  }, [stopScanner])

  const isScanning = scanStatus === "scanning" || scanStatus === "starting"

  return (
    <StaffLayout title="QR出席" subtitle="QRコードをかざして出席をとろう">
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* QRコード読み取りエリア */}
              <div className="relative overflow-hidden rounded-2xl border-4 border-primary/20 bg-black">
                {!isScanning && !isCheckingIn && !checkInResult && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 text-center text-white">
                    <Camera className="h-16 w-16" />
                    <p className="text-2xl font-bold">カメラを起動してください</p>
                  </div>
                )}
                {isCheckingIn && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 text-center text-white">
                    <Loader2 className="h-16 w-16 animate-spin" />
                    <p className="text-2xl font-bold">出席を記録中...</p>
                  </div>
                )}
                <video
                  ref={videoRef}
                  className="aspect-video h-full w-full bg-black object-cover"
                  playsInline
                  muted
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 border-4 border-white/80 shadow-lg" />
                </div>
              </div>

              {/* コントロールボタン */}
              {!checkInResult && (
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={startScanner}
                    disabled={isScanning || isCheckingIn}
                    size="lg"
                    className="text-lg"
                  >
                    {scanStatus === "starting" ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 起動中...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-5 w-5" /> カメラを起動
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={stopScanner}
                    disabled={scanStatus === "idle" || scanStatus === "stopped" || isCheckingIn}
                    size="lg"
                    className="text-lg"
                  >
                    <VideoOff className="mr-2 h-5 w-5" /> 停止
                  </Button>
                </div>
              )}

              {/* エラーメッセージ */}
              {errorMessage && (
                <div className="flex items-start gap-3 rounded-lg border-2 border-destructive/30 bg-destructive/10 p-4 text-destructive">
                  <TriangleAlert className="mt-1 h-6 w-6" />
                  <p className="text-lg font-medium">{errorMessage}</p>
                </div>
              )}

              {/* 出席記録結果 */}
              {checkInResult && (
                <div className="space-y-4">
                  {checkInResult.success ? (
                    <div className="rounded-2xl border-4 border-green-500 bg-green-50 p-8 text-center dark:bg-green-950">
                      <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-green-500 p-6">
                          <Check className="h-16 w-16 text-white" />
                        </div>
                      </div>
                      <p className="mb-2 text-2xl font-bold text-green-800 dark:text-green-200">
                        しゅっせき かんりょう！
                      </p>
                      {checkInResult.data && (
                        <div className="mt-6 space-y-3">
                          <p className="text-4xl font-bold text-green-900 dark:text-green-100">
                            {checkInResult.data.child_name}
                          </p>
                          <p className="text-2xl font-semibold text-green-800 dark:text-green-200">
                            {checkInResult.data.class_name}
                          </p>
                          <p className="text-xl text-green-700 dark:text-green-300">
                            {new Date(checkInResult.data.checked_in_at).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      )}
                      <Button
                        onClick={() => setCheckInResult(null)}
                        size="lg"
                        className="mt-6 text-lg"
                      >
                        つぎのおともだち
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border-4 border-red-500 bg-red-50 p-8 text-center dark:bg-red-950">
                      <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-red-500 p-6">
                          <TriangleAlert className="h-16 w-16 text-white" />
                        </div>
                      </div>
                      <p className="mb-4 text-2xl font-bold text-red-800 dark:text-red-200">
                        エラーが はっせい しました
                      </p>
                      <p className="text-lg text-red-700 dark:text-red-300">
                        {checkInResult.error}
                      </p>
                      <Button
                        onClick={() => setCheckInResult(null)}
                        variant="outline"
                        size="lg"
                        className="mt-6 text-lg"
                      >
                        もういちど やってみる
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
