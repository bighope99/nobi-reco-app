'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { Hand, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toKatakana } from "@/lib/utils/kana"

type ChildStatus = 'not_checked_in' | 'checked_in' | 'checked_out'

interface ChildRecord {
  id: string
  kanaName: string
  kanjiName: string
  gradeLabel?: string
  status: ChildStatus
  checkedInAt?: string
  checkedOutAt?: string
}

type View = 'row-select' | 'vowel-select' | 'child-select' | 'feedback'

const VOWEL_THRESHOLD = 6

const ROW_VOWELS: Record<string, string[]> = {
  'あ': ['あ', 'い', 'う', 'え', 'お'],
  'か': ['か', 'き', 'く', 'け', 'こ'],
  'さ': ['さ', 'し', 'す', 'せ', 'そ'],
  'た': ['た', 'ち', 'つ', 'て', 'と'],
  'な': ['な', 'に', 'ぬ', 'ね', 'の'],
  'は': ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  'ま': ['ま', 'み', 'む', 'め', 'も'],
  'や': ['や', 'ゆ', 'よ'],
  'ら': ['ら', 'り', 'る', 'れ', 'ろ'],
  'わ': ['わ', 'を', 'ん'],
}

const KANA_ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

function formatTime(isoString?: string): string {
  if (!isoString) return ''
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function updateChildInGroups(
  groups: Record<string, ChildRecord[]>,
  childId: string,
  updater: (child: ChildRecord) => ChildRecord
): Record<string, ChildRecord[]> {
  const next: Record<string, ChildRecord[]> = {}
  for (const [row, children] of Object.entries(groups)) {
    next[row] = children.map(c => c.id === childId ? updater(c) : c)
  }
  return next
}

export default function SelfCheckInPage() {
  const [groups, setGroups] = useState<Record<string, ChildRecord[]>>({})
  const [loading, setLoading] = useState(true)
  const optimisticIdsRef = useRef<Set<string>>(new Set())

  const [view, setView] = useState<View>('row-select')
  const [selectedRow, setSelectedRow] = useState<string>('')
  const [selectedVowel, setSelectedVowel] = useState<string>('')
  const [selectedChild, setSelectedChild] = useState<ChildRecord | null>(null)
  const [checkinTime, setCheckinTime] = useState<string>('')
  const [checkinAction, setCheckinAction] = useState<'check_in' | 'check_out'>('check_in')
  const [attendanceId, setAttendanceId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(3)

  const fetchChildren = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/self-checkin/children')
      if (!res.ok) return
      const data = await res.json()
      const serverGroups: Record<string, ChildRecord[]> = data.groups ?? {}
      setGroups(prev => {
        if (optimisticIdsRef.current.size === 0) return serverGroups
        const merged: Record<string, ChildRecord[]> = {}
        for (const [row, children] of Object.entries(serverGroups)) {
          merged[row] = children.map(sc => {
            if (optimisticIdsRef.current.has(sc.id)) {
              const prevChild = prev[row]?.find(pc => pc.id === sc.id)
              return prevChild ?? sc
            }
            return sc
          })
        }
        return merged
      })
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

  const goToFeedback = (child: ChildRecord) => {
    const action: 'check_in' | 'check_out' = child.status !== 'checked_in' ? 'check_in' : 'check_out'

    // Optimistic update
    setGroups(prev => updateChildInGroups(prev, child.id, c => ({
      ...c,
      status: action === 'check_in' ? 'checked_in' : 'checked_out',
      checkedInAt: action === 'check_in' ? new Date().toISOString() : c.checkedInAt,
      checkedOutAt: action === 'check_out' ? new Date().toISOString() : c.checkedOutAt,
    })))
    optimisticIdsRef.current.add(child.id)

    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setSelectedChild(child)
    setCheckinTime(timeStr)
    setCheckinAction(action)
    setCountdown(3)
    setView('feedback')

    // Fire-and-forget API call
    fetch('/api/attendance/self-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: child.id }),
    })
      .then(res => res.json())
      .then(data => {
        setAttendanceId(data.attendance_id ?? null)
        optimisticIdsRef.current.delete(child.id)
      })
      .catch(() => {
        console.error('出席登録に失敗しました')
        optimisticIdsRef.current.delete(child.id)
      })
  }

  const handleUndo = () => {
    if (selectedChild) {
      // Optimistic revert
      const childId = selectedChild.id
      setGroups(prev => updateChildInGroups(prev, childId, c => ({
        ...c,
        status: checkinAction === 'check_in' ? 'not_checked_in' : 'checked_in',
        checkedInAt: checkinAction === 'check_in' ? undefined : c.checkedInAt,
        checkedOutAt: checkinAction === 'check_out' ? undefined : c.checkedOutAt,
      })))
      optimisticIdsRef.current.add(childId)

      setView('child-select')

      // Fire-and-forget DELETE
      if (attendanceId) {
        fetch('/api/attendance/self-checkin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance_id: attendanceId, action: checkinAction }),
        })
          .then(() => {
            optimisticIdsRef.current.delete(childId)
          })
          .catch(() => {
            optimisticIdsRef.current.delete(childId)
          })
      } else {
        optimisticIdsRef.current.delete(childId)
      }
    } else {
      setView('child-select')
    }

    setAttendanceId(null)
  }

  useEffect(() => {
    if (view !== 'feedback') return
    if (countdown <= 0) {
      setView('row-select')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [view, countdown])

  // 表示する児童（母音フィルタ含む）
  const rowChildren = groups[selectedRow] ?? []
  const visibleChildren = selectedVowel
    ? rowChildren.filter((c) => toKatakana(c.kanaName).startsWith(toKatakana(selectedVowel)))
    : rowChildren

  // 修正2: 母音ごとの人数（disabled判定に使用）
  const vowelCounts = Object.fromEntries(
    (ROW_VOWELS[selectedRow] ?? []).map((vowel) => [
      vowel,
      rowChildren.filter((c) => toKatakana(c.kanaName).startsWith(toKatakana(vowel))).length,
    ])
  )

  const childSelectTitle = selectedVowel
    ? `「${selectedRow}行・${selectedVowel}」のおともだち`
    : `「${selectedRow}」のおともだち`

  return (
    <div className="h-screen overflow-y-auto bg-background p-4 sm:p-6">
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
                {(ROW_VOWELS[selectedRow] ?? []).map((vowel) => {
                  const count = vowelCounts[vowel] ?? 0
                  return (
                    <Button
                      key={vowel}
                      variant="ghost"
                      onClick={() => count > 0 && handleVowelSelect(vowel)}
                      disabled={count === 0}
                      className={[
                        'flex min-h-24 h-auto flex-col items-center justify-center gap-1 rounded-2xl bg-white shadow-md',
                        'active:scale-95 transition-transform',
                        count > 0 ? 'hover:bg-blue-50' : 'opacity-40 cursor-not-allowed',
                      ].join(' ')}
                    >
                      <span className="text-6xl font-bold">{vowel}</span>
                      <span className="text-sm text-gray-500">{count}にん</span>
                    </Button>
                  )
                })}
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
                  {checkinAction === 'check_in' ? 'しゅっせき かんりょう！' : 'またね！'}
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
    </div>
  )
}

function ChildButton({
  child,
  onSelect,
}: {
  child: ChildRecord
  onSelect: (child: ChildRecord) => void
}) {
  if (child.status === 'checked_in') {
    return (
      <button
        onClick={() => onSelect(child)}
        className={[
          'flex min-h-24 w-full flex-col items-center justify-center text-center rounded-2xl border-2 border-green-400 bg-green-50 px-4 py-3 shadow-md',
          'active:scale-95 transition-transform hover:bg-green-100',
        ].join(' ')}
      >
        <div className="flex items-center justify-center gap-2">
          <Badge className="h-3 w-3 rounded-full bg-green-500 p-0 shrink-0" />
          <span className="text-sm font-bold text-green-600">きたよ！ {formatTime(child.checkedInAt)}　タップでかえる</span>
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-1">{child.kanaName}</p>
        <p className="text-base text-gray-500">{child.kanjiName}</p>
        {child.gradeLabel && <p className="text-sm text-gray-400">{child.gradeLabel}</p>}
      </button>
    )
  }

  if (child.status === 'checked_out') {
    return (
      <div className="flex min-h-24 w-full flex-col items-center justify-center text-center rounded-2xl border-2 border-blue-400 bg-blue-50 px-4 py-3 shadow-md">
        <div className="flex items-center justify-center gap-2">
          <Badge className="h-3 w-3 rounded-full bg-blue-500 p-0 shrink-0" />
          <span className="text-sm font-bold text-blue-600">かえったよ {formatTime(child.checkedOutAt)}</span>
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-1">{child.kanaName}</p>
        <p className="text-base text-gray-500">{child.kanjiName}</p>
        {child.gradeLabel && <p className="text-sm text-gray-400">{child.gradeLabel}</p>}
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={() => onSelect(child)}
      className={[
        'flex min-h-24 h-auto w-full flex-col items-center justify-center text-center rounded-2xl bg-white px-4 py-3 shadow-md',
        'active:scale-95 transition-transform hover:bg-blue-50',
      ].join(' ')}
    >
      <p className="text-3xl font-bold text-gray-800">{child.kanaName}</p>
      <p className="text-base text-gray-500">{child.kanjiName}</p>
      {child.gradeLabel && <p className="text-sm text-gray-400">{child.gradeLabel}</p>}
    </Button>
  )
}
