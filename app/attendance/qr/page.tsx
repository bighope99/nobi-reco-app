'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Check, Home, Loader2, SwitchCamera, TriangleAlert, VideoOff } from "lucide-react"
import { BrowserQRCodeReader } from "@zxing/browser"

import { Button } from "@/components/ui/button"

interface AttendanceQrPayload {
  type: string
  child_id: string
  facility_id: string
  signature: string
}

type ScanStatus = "idle" | "starting" | "scanning" | "stopped"
type CameraFacingMode = "environment" | "user"

interface CheckInResult {
  success: boolean
  data?: {
    child_id: string
    child_name: string
    class_name: string
    checked_in_at: string
    checked_out_at?: string
    attendance_date: string
    action_type?: 'check_in' | 'check_out'
  }
  error?: string
}

export default function QRAttendanceScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [facingMode, setFacingMode] = useState<CameraFacingMode>("environment")
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [countdown, setCountdown] = useState(3)

  const stopScanner = useCallback(async () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop()
      } catch (error) {
        console.error("Error stopping code reader", error)
      }
      controlsRef.current = null
    }

    const videoElement = videoRef.current
    const srcObject = videoElement?.srcObject

    if (srcObject) {
      if (typeof MediaStream !== "undefined" && srcObject instanceof MediaStream) {
        srcObject.getTracks().forEach((track) => track.stop())
      } else if ("getTracks" in srcObject) {
        srcObject.getTracks().forEach((track) => track.stop())
      }
      if (videoElement) {
        videoElement.srcObject = null
      }
    }

    codeReaderRef.current = null
    setScanStatus("stopped")
  }, [])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [stopScanner])

  useEffect(() => {
    let isMounted = true

    const checkAvailableCameras = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!isMounted) return
        const videoInputs = devices.filter((device) => device.kind === "videoinput")
        setHasMultipleCameras(videoInputs.length > 1)
      } catch (error) {
        console.error("Failed to enumerate media devices", error)
        if (isMounted) {
          setHasMultipleCameras(false)
        }
      }
    }

    checkAvailableCameras()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!checkInResult) return
    if (countdown <= 0) {
      setCheckInResult(null)
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [checkInResult, countdown])

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
          facility_id: payload.facility_id,
        }),
      })

      const result: CheckInResult = await response.json()
      setCountdown(3)
      setCheckInResult(result)
    } catch (error) {
      console.error('Check-in error:', error)
      setCountdown(3)
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
      setCountdown(3)
      setCheckInResult({
        success: false,
        error: 'QRコードの形式が正しくありません',
      })
    }
  }

  const startScanner = useCallback(async (mode: CameraFacingMode = facingMode) => {
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

      const controls = await codeReaderRef.current.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
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
      setScanStatus("scanning")
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
  }, [facingMode, stopScanner])

  const handleToggleCamera = async () => {
    const nextMode: CameraFacingMode = facingMode === "environment" ? "user" : "environment"
    setFacingMode(nextMode)

    if (isScanning) {
      await startScanner(nextMode)
    }
  }

  const isScanning = scanStatus === "scanning" || scanStatus === "starting"

  return (
    <div className="h-screen overflow-y-auto bg-background p-4 sm:p-6">
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
            className="aspect-square sm:aspect-video h-full w-full bg-black object-cover"
            playsInline
            muted
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 sm:h-48 sm:w-48 border-4 border-white/80 shadow-lg" />
          </div>
          {isScanning && (
            <button
              type="button"
              onClick={handleToggleCamera}
              disabled={isCheckingIn}
              aria-label="カメラを切り替え"
              className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm transition hover:bg-black/70 active:scale-95 disabled:opacity-50"
            >
              <SwitchCamera className="h-6 w-6" />
            </button>
          )}
          {checkInResult && (
            <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center text-center p-6 ${
              checkInResult.success
                ? (checkInResult.data?.action_type === 'check_out' ? 'bg-blue-900/85' : 'bg-green-900/85')
                : 'bg-red-900/85'
            }`}>
              {checkInResult.success ? (
                (() => {
                  const isCheckOut = checkInResult.data?.action_type === 'check_out'
                  const displayTime = isCheckOut && checkInResult.data?.checked_out_at
                    ? checkInResult.data.checked_out_at
                    : checkInResult.data?.checked_in_at
                  return (
                    <>
                      <div className={`rounded-full ${isCheckOut ? 'bg-blue-500' : 'bg-green-500'} p-5 mb-4`}>
                        {isCheckOut ? (
                          <Home className="h-12 w-12 text-white" />
                        ) : (
                          <Check className="h-12 w-12 text-white" />
                        )}
                      </div>
                      <p className="text-2xl font-bold text-white mb-2">
                        {isCheckOut ? 'おかえり！ きをつけてね' : 'しゅっせき かんりょう！'}
                      </p>
                      {checkInResult.data && (
                        <div className="space-y-1 mt-2">
                          <p className="text-3xl font-bold text-white">{checkInResult.data.child_name}</p>
                          <p className="text-xl font-semibold text-white/90">{checkInResult.data.class_name}</p>
                          <p className="text-lg text-white/80">
                            {displayTime && new Date(displayTime).toLocaleTimeString('ja-JP', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      )}
                      <p className="text-xl text-white/70 mt-4">{countdown}びょうで もどります</p>
                    </>
                  )
                })()
              ) : (
                <>
                  <div className="rounded-full bg-red-500 p-5 mb-4">
                    <TriangleAlert className="h-12 w-12 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-white mb-2">エラーが はっせい しました</p>
                  <p className="text-lg text-white/90">{checkInResult.error}</p>
                  <p className="text-xl text-white/70 mt-4">{countdown}びょうで もどります</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* コントロールボタン */}
        {!checkInResult && (
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              onClick={() => startScanner()}
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
      </div>
    </div>
  )
}
