'use client'

import { useCallback, useEffect, useState } from "react"
import { Hand, Loader2 } from "lucide-react"
import { StaffLayout } from "@/components/layout/staff-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ChildStatus = 'not_checked_in' | 'checked_in' | 'checked_out'

interface ChildRecord {
  id: string
  kanaName: string
  kanjiName: string
  grade?: number
  status: ChildStatus
  checkedInAt?: string
  checkedOutAt?: string
}

type View = 'row-select' | 'vowel-select' | 'child-select' | 'feedback'

const VOWEL_THRESHOLD = 6
const VOWELS = ['あ', 'い', 'う', 'え', 'お']

const KANA_ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

function formatTime(isoString?: string): string {
  if (!isoString) return ''
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function SelfCheckInPage() {
  const [groups, setGroups] = useState<Record<string, ChildRecord[]>>({})
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<View>('row-select')
  const [selectedRow, setSelectedRow] = useState<string>('')
  const [selectedVowel, setSelectedVowel] = useState<string>('')
  const [selectedChild, setSelectedChild] = useState<ChildRecord | null>(null)
  const [checkinTime, setCheckinTime] = useState<string>('')
  const [checkinAction, setCheckinAction] = useState<'check_in' | 'check_out'>('check_in')
  const [attendanceId, setAttendanceId] = useState<string | null>(null)
  const [loadingChildId, setLoadingChildId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)

  const fetchChildren = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/self-checkin/children')
      if (!res.ok) return
      const data = await res.json()
      setGroups(data.groups ?? {})
    } catch {
      // fetch失敗時は無視（ポーリングで再試行）
    } finally {
      setLoading(false)
    }
  }, [])

  // 初回取得 + 30秒ポーリング
  useEffect(() => {
    fetchChildren()
    const interval = setInterval(fetchChildren, 30_000)
    return () => clearInterval(interval)
  }, [fetchChildren])

  const rowCounts = Object.fromEntries(
    KANA_ROWS.map((row) => [row, groups[row]?.length ?? 0])
  )

  const handleRowSelect = (row: string, count: number) => {
    setSelectedRow(row)
    setSelectedVowel('')
    if (count >= VOWEL_THRESHOLD) {
      setView('vowel-select')
    } else {
      setView('child-select')
    }
  }

  const handleVowelSelect = (vowel: string) => {
    setSelectedVowel(vowel)
    setView('child-select')
  }

  const goToFeedback = async (child: ChildRecord) => {
    setLoadingChildId(child.id)
    try {
      const res = await fetch('/api/attendance/self-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: child.id }),
      })
      const data = await res.json()
      const time = data.time ? formatTime(data.time) : formatTime(new Date().toISOString())
      setCheckinTime(time)
      setCheckinAction(data.action ?? 'check_in')
      setAttendanceId(data.attendance_id ?? null)
    } catch {
      const now = new Date()
      setCheckinTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      setCheckinAction('check_in')
      setAttendanceId(null)
    } finally {
      setLoadingChildId(null)
    }
    setSelectedChild(child)
    setCountdown(3)
    setView('feedback')
    fetchChildren()
  }

  const handleUndo = async () => {
    if (attendanceId) {
      try {
        await fetch('/api/attendance/self-checkin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance_id: attendanceId, action: checkinAction }),
        })
      } catch {
        // エラーは無視して画面を戻す
      }
      fetchChildren()
    }
    setAttendanceId(null)
    setView('child-select')
  }

  useEffect(() => {
    if (view !== 'feedback') return
    if (countdown <= 0) {
      setView('child-select')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [view, countdown])

  // 表示する児童（母音フィルタ含む）
  const rowChildren = groups[selectedRow] ?? []
  const visibleChildren = selectedVowel
    ? rowChildren.filter((c) => c.kanaName.startsWith(selectedVowel))
    : rowChildren

  const childSelectTitle = selectedVowel
    ? `「${selectedRow}行・${selectedVowel}」のおともだち`
    : `「${selectedRow}」のおともだち`

  return (
    <StaffLayout title="タッチ出席" subtitle="なまえをえらんで しゅっせきをとろう">
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* 画面1: 50音行選択 */}
          {view === 'row-select' && (
            <div className="grid grid-cols-2 gap-4">
              {KANA_ROWS.map((row) => {
                const count = rowCounts[row] ?? 0
                return (
                  <Button
                    key={row}
                    variant="outline"
                    onClick={() => count > 0 && handleRowSelect(row, count)}
                    disabled={count === 0}
                    className={[
                      'flex min-h-24 h-auto flex-col items-center justify-center gap-1 rounded-2xl bg-white shadow-md',
                      'active:scale-95 transition-transform',
                      count > 0
                        ? 'hover:bg-blue-50 cursor-pointer'
                        : 'opacity-40 cursor-not-allowed',
                    ].join(' ')}
                  >
                    <span className="text-6xl font-bold">{row}</span>
                    <span className="text-sm text-gray-500">{count}にん</span>
                  </Button>
                )
              })}
            </div>
          )}

          {/* 画面1.5: 母音選択（6人以上の行） */}
          {view === 'vowel-select' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={() => setView('row-select')}>
                  ← もどる
                </Button>
                <span className="text-xl font-bold">「{selectedRow}行」— どれ？</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {VOWELS.map((vowel) => (
                  <Button
                    key={vowel}
                    variant="outline"
                    onClick={() => handleVowelSelect(vowel)}
                    className="flex min-h-24 h-auto flex-col items-center justify-center gap-1 rounded-2xl bg-white shadow-md hover:bg-blue-50 active:scale-95 transition-transform"
                  >
                    <span className="text-6xl font-bold">{vowel}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 画面2: 児童選択 */}
          {view === 'child-select' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedVowel ? setView('vowel-select') : setView('row-select')}
                >
                  ← もどる
                </Button>
                <span className="text-xl font-bold">{childSelectTitle}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {visibleChildren.map((child) => (
                  <ChildButton
                    key={child.id}
                    child={child}
                    onSelect={goToFeedback}
                    isLoading={loadingChildId === child.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 画面3: フィードバックオーバーレイ */}
          {view === 'feedback' && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-green-500 text-white">
              <div className="flex flex-col items-center gap-2 px-6 text-center">
                <Hand className="h-24 w-24" />
                <p className="text-5xl font-bold mt-4">
                  {checkinAction === 'check_in' ? 'しゅっせき かんりょう！' : 'たいしょ かんりょう！'}
                </p>
                <p className="text-4xl mt-2">{selectedChild?.kanaName}</p>
                <p className="text-3xl mt-1">{checkinTime}</p>
              </div>
              <div className="mt-12 flex flex-col items-center gap-4">
                <Button
                  variant="outline"
                  className="bg-white text-green-600 font-bold px-8 py-4 rounded-2xl text-2xl shadow-lg active:scale-95 transition-transform h-auto"
                  onClick={handleUndo}
                >
                  とりけす
                </Button>
                <p className="text-xl mt-2">{countdown}びょうで もどります</p>
              </div>
            </div>
          )}
        </>
      )}
    </StaffLayout>
  )
}

function ChildButton({
  child,
  onSelect,
  isLoading,
}: {
  child: ChildRecord
  onSelect: (child: ChildRecord) => void
  isLoading: boolean
}) {
  if (child.status === 'checked_in') {
    return (
      <div className="flex min-h-24 w-full flex-col justify-center rounded-2xl border-2 border-green-400 bg-green-50 px-4 py-3 shadow-md">
        <div className="flex items-center gap-2">
          <Badge className="h-3 w-3 rounded-full bg-green-500 p-0 shrink-0" />
          <span className="text-sm font-bold text-green-600">きたよ！ {formatTime(child.checkedInAt)}</span>
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-1">{child.kanaName}</p>
        <p className="text-base text-gray-500">{child.kanjiName}</p>
        {child.grade && <p className="text-sm text-gray-400">{child.grade}年生</p>}
      </div>
    )
  }

  if (child.status === 'checked_out') {
    return (
      <div className="flex min-h-24 w-full flex-col justify-center rounded-2xl border-2 border-blue-400 bg-blue-50 px-4 py-3 shadow-md">
        <div className="flex items-center gap-2">
          <Badge className="h-3 w-3 rounded-full bg-blue-500 p-0 shrink-0" />
          <span className="text-sm font-bold text-blue-600">かえったよ {formatTime(child.checkedOutAt)}</span>
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-1">{child.kanaName}</p>
        <p className="text-base text-gray-500">{child.kanjiName}</p>
        {child.grade && <p className="text-sm text-gray-400">{child.grade}年生</p>}
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={() => !isLoading && onSelect(child)}
      disabled={isLoading}
      className={[
        'flex min-h-24 h-auto w-full flex-col justify-center rounded-2xl bg-white px-4 py-3 shadow-md text-left',
        'active:scale-95 transition-transform',
        isLoading ? 'opacity-60 cursor-wait' : 'hover:bg-blue-50',
      ].join(' ')}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-gray-800">{child.kanaName}</p>
          <p className="text-base text-gray-500">{child.kanjiName}</p>
          {child.grade && <p className="text-sm text-gray-400">{child.grade}年生</p>}
        </>
      )}
    </Button>
  )
}
