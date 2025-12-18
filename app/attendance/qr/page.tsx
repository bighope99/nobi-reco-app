'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Check, Loader2, TriangleAlert, VideoOff } from "lucide-react"

import { StaffLayout } from "@/components/layout/staff-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface AttendanceQrPayload {
  type: string
  child_id: string
  facility_id: string
  signature: string
}

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement | HTMLCanvasElement | ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?: () => Promise<string[]>
}

type SupportState = "checking" | "supported" | "unsupported"

type ScanStatus = "idle" | "starting" | "scanning" | "stopped"

export default function QRAttendanceScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null)

  const [supportState, setSupportState] = useState<SupportState>("checking")
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastRawValue, setLastRawValue] = useState<string | null>(null)
  const [lastPayload, setLastPayload] = useState<AttendanceQrPayload | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const barcodeDetectorCtor = (window as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector

    if (!barcodeDetectorCtor) {
      setSupportState("unsupported")
      return
    }

    if (barcodeDetectorCtor.getSupportedFormats) {
      barcodeDetectorCtor
        .getSupportedFormats()
        .then((formats) => {
          if (formats.includes("qr_code")) {
            setSupportState("supported")
          } else {
            setSupportState("unsupported")
          }
        })
        .catch(() => setSupportState("unsupported"))
    } else {
      setSupportState("supported")
    }
  }, [])

  const stopScanner = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

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

  const scanLoop = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current)
      if (barcodes.length > 0) {
        processDetection(barcodes[0].rawValue)
      }
    } catch (error) {
      console.error("Barcode detection error", error)
      setErrorMessage("QRコードの読み取りに失敗しました。カメラ位置を調整してください。")
    }

    animationRef.current = requestAnimationFrame(scanLoop)
  }, [])

  const startScanner = useCallback(async () => {
    setErrorMessage(null)
    setScanStatus("starting")

    if (supportState !== "supported") {
      setErrorMessage("このブラウザではQRコードの読み取りに対応していません。ChromeやEdgeでお試しください。")
      setScanStatus("idle")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if (!detectorRef.current) {
        const barcodeDetectorCtor = (window as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
        if (!barcodeDetectorCtor) {
          throw new Error("BarcodeDetector is not supported")
        }

        detectorRef.current = new barcodeDetectorCtor({ formats: ["qr_code"] })
      }

      setScanStatus("scanning")
      animationRef.current = requestAnimationFrame(scanLoop)
    } catch (error) {
      console.error("Camera start error", error)
      setErrorMessage("カメラの起動に失敗しました。ブラウザの権限設定を確認してください。")
      setScanStatus("idle")
    }
  }, [scanLoop, supportState])

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
              <Button onClick={startScanner} disabled={isScanning || supportState === "checking"}>
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
              {supportState === "unsupported" && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3" /> QR読み取り非対応ブラウザ
                </Badge>
              )}
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
