'use client'

import { useCallback, useEffect, useState } from "react"
import { Hand } from "lucide-react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ChildStatus = 'absent' | 'checked-in' | 'checked-out'

interface ChildRecord {
  id: string
  name: string
  status: ChildStatus
  time?: string
}

type View = 'row-select' | 'child-select' | 'feedback'

const KANA_ROWS = [
  { row: 'あ', count: 5 },
  { row: 'か', count: 4 },
  { row: 'さ', count: 3 },
  { row: 'た', count: 6 },
  { row: 'な', count: 2 },
  { row: 'は', count: 4 },
  { row: 'ま', count: 0 },
  { row: 'や', count: 3 },
  { row: 'ら', count: 2 },
  { row: 'わ', count: 1 },
]

const DUMMY_CHILDREN: ChildRecord[] = [
  { id: '1', name: 'あおき たろう', status: 'absent' },
  { id: '2', name: 'あさの はなこ', status: 'checked-in', time: '14:30' },
  { id: '3', name: 'いとう じろう', status: 'checked-out', time: '17:00' },
  { id: '4', name: 'うえだ みく', status: 'absent' },
  { id: '5', name: 'えのもと けんた', status: 'absent' },
]

export default function SelfCheckInPage() {
  const [view, setView] = useState<View>('row-select')
  const [selectedRow, setSelectedRow] = useState<string>('')
  const [selectedChild, setSelectedChild] = useState<ChildRecord | null>(null)
  const [checkinTime, setCheckinTime] = useState<string>('')
  const [countdown, setCountdown] = useState(3)

  const goToChildSelect = (row: string) => {
    setSelectedRow(row)
    setView('child-select')
  }

  const goToFeedback = (child: ChildRecord) => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setCheckinTime(`${hh}:${mm}`)
    setSelectedChild(child)
    setCountdown(3)
    setView('feedback')
  }

  const backToChildSelect = useCallback(() => {
    setView('child-select')
  }, [])

  useEffect(() => {
    if (view !== 'feedback') return
    if (countdown <= 0) {
      backToChildSelect()
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [view, countdown, backToChildSelect])

  return (
    <StaffLayout title="タッチ出席" subtitle="なまえをえらんで しゅっせきをとろう">
      {/* 画面1: 50音行選択 */}
      {view === 'row-select' && (
        <div className="grid grid-cols-2 gap-4">
          {KANA_ROWS.map(({ row, count }) => (
            <button
              key={row}
              onClick={() => count > 0 && goToChildSelect(row)}
              disabled={count === 0}
              className={[
                'flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-white shadow-md',
                'active:scale-95 transition-transform',
                count > 0
                  ? 'hover:bg-blue-50 cursor-pointer'
                  : 'opacity-40 cursor-not-allowed',
              ].join(' ')}
            >
              <span className="text-6xl font-bold">{row}</span>
              <span className="text-sm text-gray-500">{count}にん</span>
            </button>
          ))}
        </div>
      )}

      {/* 画面2: 児童選択 */}
      {view === 'child-select' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setView('row-select')}>
              ← もどる
            </Button>
            <span className="text-xl font-bold">「{selectedRow}」のおともだち</span>
          </div>
          {DUMMY_CHILDREN.map((child) => (
            <ChildButton key={child.id} child={child} onSelect={goToFeedback} />
          ))}
        </div>
      )}

      {/* 画面3: フィードバックオーバーレイ */}
      {view === 'feedback' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-500 text-white">
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <Hand className="h-24 w-24" />
            <p className="text-5xl font-bold mt-4">しゅっせき かんりょう！</p>
            <p className="text-4xl mt-2">{selectedChild?.name}</p>
            <p className="text-3xl mt-1">{checkinTime}</p>
          </div>
          <div className="mt-12 flex flex-col items-center gap-4">
            <Button
              variant="outline"
              size="lg"
              className="border-2 border-white text-white hover:bg-green-400 text-2xl px-10 py-4 h-auto"
              onClick={backToChildSelect}
            >
              とりけす
            </Button>
            <p className="text-xl mt-2">{countdown}びょうで もどります</p>
          </div>
        </div>
      )}
    </StaffLayout>
  )
}

function ChildButton({
  child,
  onSelect,
}: {
  child: ChildRecord
  onSelect: (child: ChildRecord) => void
}) {
  if (child.status === 'checked-in') {
    return (
      <div className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-green-400 bg-green-50 px-6 shadow-md">
        <Badge className="h-4 w-4 rounded-full bg-green-500 p-0 shrink-0" />
        <span className="flex-1 text-4xl font-bold text-gray-800">{child.name}</span>
        <span className="text-sm font-bold text-green-600 text-right leading-tight">
          きたよ！<br />{child.time}
        </span>
      </div>
    )
  }

  if (child.status === 'checked-out') {
    return (
      <div className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-blue-400 bg-blue-50 px-6 shadow-md">
        <Badge className="h-4 w-4 rounded-full bg-blue-500 p-0 shrink-0" />
        <span className="flex-1 text-4xl font-bold text-gray-800">{child.name}</span>
        <span className="text-sm font-bold text-blue-600 text-right leading-tight">
          かえったよ<br />{child.time}
        </span>
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(child)}
      className="flex min-h-20 w-full items-center gap-4 rounded-2xl bg-white px-6 shadow-md hover:bg-blue-50 active:scale-95 transition-transform text-left"
    >
      <Badge variant="outline" className="h-4 w-4 rounded-full p-0 shrink-0" />
      <span className="flex-1 text-4xl font-bold text-gray-800">{child.name}</span>
    </button>
  )
}
