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

export default function QRAttendanceScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastRawValue, setLastRawValue] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<AttendanceQrPayload | null>(null)

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

  const processDetection = (rawValue: string) => {
    setLastRawValue(rawValue)
    const payload = parsePayload(rawValue)
    setLastPayload(payload)
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
    <StaffLayout title="QR出欠" subtitle="タブレットのカメラで児童のQRコードを読み取り">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>QRコード読み取り</CardTitle>
            <CardDescription>タブレットの背面カメラを使ってQRコードをスキャンします</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative overflow-hidden rounded-xl border bg-black">
              {!isScanning && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-center text-white">
                  <Camera className="h-10 w-10" />
                  <p className="text-sm font-medium">カメラを起動してQRコードを読み取ります</p>
                </div>
              )}
              <video
                ref={videoRef}
                className="aspect-video h-full w-full bg-black object-cover"
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-40 border-2 border-white/60" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={startScanner} disabled={isScanning}>
                {scanStatus === "starting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 起動中...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" /> カメラを起動
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={stopScanner}
                disabled={scanStatus === "idle" || scanStatus === "stopped"}
              >
                <VideoOff className="mr-2 h-4 w-4" /> 停止
              </Button>
            </div>
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4" />
                <p>{errorMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>読み取り結果</CardTitle>
            <CardDescription>児童のQRコードをスキャンするとここに表示されます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastRawValue ? (
              <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">QRデータ</Label>
                <p className="break-all font-mono text-sm leading-relaxed">{lastRawValue}</p>
                {lastPayload ? (
                  <div className="mt-2 space-y-1 rounded-md bg-muted/60 p-2 text-sm">
                    <div className="flex items-center gap-2 font-semibold">
                      <Check className="h-4 w-4 text-green-600" />
                      attendance QR として認識しました
                    </div>
                    <p>児童ID: {lastPayload.child_id}</p>
                    <p>施設ID: {lastPayload.facility_id}</p>
                    <p className="text-xs text-muted-foreground">署名: {lastPayload.signature}</p>
                  </div>
                ) : (
                  <p className="text-sm text-destructive">attendance用QRではないか、形式が正しくありません。</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">まだQRコードは読み取られていません。</p>
            )}
            <p className="text-xs text-muted-foreground">
              読み取ったデータは出欠チェックインAPIに連携する想定です。署名検証・打刻処理はAPI側で実装してください。
            </p>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
