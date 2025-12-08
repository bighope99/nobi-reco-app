import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QrCode } from "lucide-react"

export default function QRAttendancePage() {
  return (
    <StaffLayout title="QR出欠" subtitle="QRコードで出席確認">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">出席確認QRコード</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
              <QrCode className="h-32 w-32 text-muted-foreground" />
            </div>
            <p className="text-center text-sm text-muted-foreground">このQRコードをスキャンして出席を記録します</p>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  )
}
