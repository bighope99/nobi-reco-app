"use client"

import { StaffLayout } from "@/components/layout/staff-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { mockChildren } from "@/lib/mock-data"

const weekdays = ["月", "火", "水", "木", "金"]

export default function AttendanceSchedulePage() {
  return (
    <StaffLayout title="出席予定登録" subtitle="曜日ベースの通所設定">
      <Card>
        <CardHeader>
          <CardTitle>通所予定設定</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">名前</th>
                  <th className="px-4 py-3 text-left font-medium">クラス</th>
                  {weekdays.map((day) => (
                    <th key={day} className="px-4 py-3 text-center font-medium">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockChildren.map((child) => (
                  <tr key={child.id} className="border-b border-border">
                    <td className="px-4 py-3">{child.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{child.className}</td>
                    {weekdays.map((day) => (
                      <td key={day} className="px-4 py-3 text-center">
                        <Checkbox defaultChecked={Math.random() > 0.3} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </StaffLayout>
  )
}
