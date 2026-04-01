'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Hand, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toKatakana } from "@/lib/utils/kana"
import { formatTimeJST, getCurrentTimeJST } from '@/lib/utils/timezone'

/** 濁音・半濁音を清音に変換（カタカナ1文字） */
function stripDakuten(ch: string): string {
  // 濁音 (ガ→カ, ギ→キ, ... ヅ→ツ, ... ボ→ホ)
  const code = ch.charCodeAt(0)
  // カ(0x30AB)〜ド(0x30C9): 濁音は奇数コード、清音は偶数
  if (code >= 0x30AC && code <= 0x30C2 && code % 2 === 0) return String.fromCharCode(code - 1) // ガ〜ヂ
  if (code >= 0x30C5 && code <= 0x30C9 && code % 2 === 1) return String.fromCharCode(code - 1) // ヅ〜ド
  // バ行: バ(0x30D0),ビ,ブ,ベ,ボ — 清音はハ(0x30CF),ヒ,フ,ヘ,ホ (offset -1)
  // パ行: パ(0x30D1),ピ,プ,ペ,ポ — 清音はハ,ヒ,フ,ヘ,ホ (offset -2)
  if (code >= 0x30D0 && code <= 0x30DD) {
    const offset = code - 0x30CF // 0x30CF = ハ
    const mod = offset % 3 // バ=1,パ=2,ビ=4→1,ピ=5→2...
    if (mod === 1) return String.fromCharCode(code - 1) // 濁音
    if (mod === 2) return String.fromCharCode(code - 2) // 半濁音
  }
  return ch
}

/** 名前の先頭カタカナを清音化して比較 */
function nameMatchesKana(kanaName: string, targetKana: string): boolean {
  const first = toKatakana(kanaName).charAt(0)
  const targetKatakana = toKatakana(targetKana).charAt(0)
  return stripDakuten(first) === targetKatakana
}

type ChildStatus = 'not_checked_in' | 'checked_in' | 'checked_out'

interface ChildRecord {
  id: string
  kanaName: string
  kanjiName: string
  gradeLabel?: string
  status: ChildStatus
  attendanceId?: string
  checkedInAt?: string
  checkedOutAt?: string
}

type View = 'kana-select' | 'child-select' | 'feedback'

const KANA_ROW_MAP: Record<string, string> = {}
const ROW_KANA: [string, string[]][] = [
  ['あ', ['あ', 'い', 'う', 'え', 'お']],
  ['か', ['か', 'き', 'く', 'け', 'こ']],
  ['さ', ['さ', 'し', 'す', 'せ', 'そ']],
  ['た', ['た', 'ち', 'つ', 'て', 'と']],
  ['な', ['な', 'に', 'ぬ', 'ね', 'の']],
  ['は', ['は', 'ひ', 'ふ', 'へ', 'ほ']],
  ['ま', ['ま', 'み', 'む', 'め', 'も']],
  ['や', ['や', 'ゆ', 'よ']],
  ['ら', ['ら', 'り', 'る', 'れ', 'ろ']],
  ['わ', ['わ', 'を', 'ん']],
]
for (const [row, kanas] of ROW_KANA) {
  for (const k of kanas) {
    KANA_ROW_MAP[k] = row
  }
}

/** 縦書き五十音表（右→左、上→下） */
const KANA_GRID: (string | null)[][] = [
  ['わ', 'ら', 'や', 'ま', 'は', 'な', 'た', 'さ', 'か', 'あ'],
  [null,  'り', null,  'み', 'ひ', 'に', 'ち', 'し', 'き', 'い'],
  [null,  'る', 'ゆ',  'む', 'ふ', 'ぬ', 'つ', 'す', 'く', 'う'],
  [null,  'れ', null,  'め', 'へ', 'ね', 'て', 'せ', 'け', 'え'],
  ['を',  'ろ', 'よ',  'も', 'ほ', 'の', 'と', 'そ', 'こ', 'お'],
  ['ん',  null,  null,  null, null,  null, null, null, null, null],
]


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
  const pendingPostRef = useRef<Promise<{ attendance_id: string }> | null>(null)

  const [view, setView] = useState<View>('kana-select')
  const [selectedKana, setSelectedKana] = useState<string>('')
  const [selectedChild, setSelectedChild] = useState<ChildRecord | null>(null)
  const [checkinTime, setCheckinTime] = useState<string>('')
  const [checkinHour, setCheckinHour] = useState<number>(0)
  const [checkinAction, setCheckinAction] = useState<'check_in' | 'check_out'>('check_in')
  const [attendanceId, setAttendanceId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(5)

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

  // 各かな文字ごとの児童数
  const kanaCounts = useMemo(() => Object.fromEntries(
    Object.keys(KANA_ROW_MAP).map((kana) => {
      const row = KANA_ROW_MAP[kana]
      const children = groups[row] ?? []
      return [kana, children.filter(c => nameMatchesKana(c.kanaName, kana)).length]
    })
  ), [groups])

  const handleKanaSelect = (kana: string) => {
    setSelectedKana(kana)
    setView('child-select')
  }

  const goToFeedback = (child: ChildRecord) => {
    if (child.status === 'checked_in' || child.status === 'checked_out') {
      setSelectedChild(child)
      setCheckinAction(child.status === 'checked_in' ? 'check_in' : 'check_out')
      setCheckinTime(formatTime(child.status === 'checked_out' ? child.checkedOutAt : child.checkedInAt))
      setCheckinHour(new Date().getHours())
      setAttendanceId(child.attendanceId ?? null)
      setCountdown(3)
      setView('feedback')
      pendingPostRef.current = null
      return
    }

    const action: 'check_in' | 'check_out' = child.status === 'not_checked_in' ? 'check_in' : 'check_out'

    // Optimistic update
    setGroups(prev => updateChildInGroups(prev, child.id, c => ({
      ...c,
      status: action === 'check_in' ? 'checked_in' : 'checked_out',
      checkedInAt: action === 'check_in' ? new Date().toISOString() : c.checkedInAt,
      checkedOutAt: action === 'check_out' ? new Date().toISOString() : c.checkedOutAt,
    })))
    optimisticIdsRef.current.add(child.id)

    const timeStr = getCurrentTimeJST()
    const jstHour = parseInt(timeStr.split(':')[0], 10)
    setSelectedChild(child)
    setCheckinTime(timeStr)
    setCheckinHour(jstHour)
    setCheckinAction(action)
    setCountdown(5)
    setView('feedback')

    // Fire-and-forget API call（Promiseをrefに保持してundo時に利用）
    const postPromise = fetch('/api/attendance/self-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ child_id: child.id }),
    })
      .then(res => res.json())
      .then(data => {
        const id = (data.attendance_id as string) ?? ''
        setAttendanceId(id || null)
        optimisticIdsRef.current.delete(child.id)
        pendingPostRef.current = null
        return { attendance_id: id }
      })
      .catch(() => {
        console.error('出席登録に失敗しました')
        optimisticIdsRef.current.delete(child.id)
        pendingPostRef.current = null
        return { attendance_id: '' }
      })
    pendingPostRef.current = postPromise
  }

  const handleUndo = () => {
    if (selectedChild) {
      // Optimistic revert
      const childId = selectedChild.id
      const prevStatus = selectedChild.status
      setGroups(prev => updateChildInGroups(prev, childId, c => ({
        ...c,
        status: prevStatus,
        checkedInAt: prevStatus === 'not_checked_in' ? undefined : c.checkedInAt,
        checkedOutAt: prevStatus === 'checked_out' ? selectedChild.checkedOutAt : undefined,
      })))
      optimisticIdsRef.current.add(childId)

      setView('child-select')

      // サーバー側の取り消し
      const sendDelete = (id: string) => {
        fetch('/api/attendance/self-checkin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance_id: id, action: checkinAction }),
        })
          .finally(() => {
            optimisticIdsRef.current.delete(childId)
          })
      }

      const currentPendingPost = pendingPostRef.current
      pendingPostRef.current = null
      const currentAttendanceId = attendanceId

      if (currentAttendanceId) {
        // POSTレスポンス済み → すぐDELETE
        sendDelete(currentAttendanceId)
      } else if (currentPendingPost) {
        // POST応答待ち → 完了後にDELETE
        currentPendingPost.then(({ attendance_id }) => {
          if (attendance_id) {
            sendDelete(attendance_id)
          } else {
            optimisticIdsRef.current.delete(childId)
          }
        }).catch(() => {
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
      setView('kana-select')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [view, countdown])

  // 選択されたかなに該当する児童
  const visibleChildren = useMemo(() => {
    if (!selectedKana) return []
    const row = KANA_ROW_MAP[selectedKana] ?? ''
    return (groups[row] ?? []).filter((c) => nameMatchesKana(c.kanaName, selectedKana))
  }, [selectedKana, groups])

  return (
    <div className="h-screen overflow-y-auto bg-background p-4 sm:p-6">
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* 画面1: 50音選択（縦書き・右から左） */}
          {view === 'kana-select' && (
            <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
              {KANA_GRID.flat().map((kana, i) => {
                if (!kana) return <div key={i} />
                const count = kanaCounts[kana] ?? 0
                return (
                  <button
                    key={i}
                    onClick={() => count > 0 && handleKanaSelect(kana)}
                    disabled={count === 0}
                    className={[
                      'flex aspect-square flex-col items-center justify-center rounded-xl bg-white shadow-md',
                      'active:scale-95 transition-transform',
                      count > 0
                        ? 'hover:bg-blue-50 cursor-pointer'
                        : 'opacity-30 cursor-not-allowed',
                    ].join(' ')}
                  >
                    <span className="text-2xl sm:text-4xl font-bold">{kana}</span>
                    {count > 0 && <span className="text-[10px] sm:text-xs text-gray-500">{count}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* 画面2: 児童選択 */}
          {view === 'child-select' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setView('kana-select')}
                >
                  ← もどる
                </Button>
                <span className="text-xl font-bold">「{selectedKana}」のおともだち</span>
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
          {view === 'feedback' && (() => {
            const isCheckIn = checkinAction === 'check_in'
            const feedbackText = isCheckIn
              ? (checkinHour < 12 ? 'おはよう！' : 'おかえり！')
              : 'さようなら！'
            const bgColor = isCheckIn ? '#FFFACD' : '#AFEEEE'
            const textColor = isCheckIn ? '#78590A' : '#1A6B6B'
            return (
              <div
                className="fixed inset-0 z-50 flex flex-col items-center justify-center"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <Hand className="h-24 w-24" />
                  <p className="text-5xl font-bold mt-4">{feedbackText}</p>
                  <p className="text-4xl mt-2">{selectedChild?.kanaName}</p>
                  <p className="text-3xl mt-1">{checkinTime}</p>
                </div>
                <div className="mt-12 flex flex-col items-center gap-4">
                  <Button
                    variant="outline"
                    className="font-bold px-8 py-4 rounded-2xl text-2xl shadow-lg active:scale-95 transition-transform h-auto"
                    style={{ backgroundColor: 'white', color: textColor }}
                    onClick={handleUndo}
                  >
                    とりけす
                  </Button>
                  <p className="text-xl mt-2">{countdown}びょうで もどります</p>
                </div>
              </div>
            )
          })()}
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
          <span className="text-sm font-bold text-green-600">きたよ！ {formatTimeJST(child.checkedInAt) ?? ''}　タップでかえる</span>
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-1">{child.kanaName}</p>
        <p className="text-base text-gray-500">{child.kanjiName}</p>
        {child.gradeLabel && <p className="text-sm text-gray-400">{child.gradeLabel}</p>}
      </button>
    )
  }

  if (child.status === 'checked_out') {
    return (
      <button
        onClick={() => onSelect(child)}
        className={[
          'flex min-h-24 w-full flex-col items-center justify-center text-center rounded-2xl border-2 border-blue-400 bg-blue-50 px-4 py-3 shadow-md',
          'active:scale-95 transition-transform hover:bg-blue-100',
        ].join(' ')}
      >
        <div className="flex items-center justify-center gap-2">
          <Badge className="h-3 w-3 rounded-full bg-blue-500 p-0 shrink-0" />
          <span className="text-sm font-bold text-blue-600">かえったよ {formatTimeJST(child.checkedOutAt) ?? ''}</span>
        </div>
        <p className="text-3xl font-bold text-gray-800 mt-1">{child.kanaName}</p>
        <p className="text-base text-gray-500">{child.kanjiName}</p>
        {child.gradeLabel && <p className="text-sm text-gray-400">{child.gradeLabel}</p>}
      </button>
    )
  }

  return (
    <button
      onClick={() => onSelect(child)}
      className={[
        'flex min-h-24 w-full flex-col items-center justify-center text-center rounded-2xl border bg-white px-4 py-3 shadow-md',
        'active:scale-95 transition-transform hover:bg-blue-50',
      ].join(' ')}
    >
      <p className="text-3xl font-bold text-gray-800">{child.kanaName}</p>
      <p className="text-base text-gray-500">{child.kanjiName}</p>
      {child.gradeLabel && <p className="text-sm text-gray-400">{child.gradeLabel}</p>}
    </button>
  )
}
