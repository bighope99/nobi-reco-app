import { NextResponse } from 'next/server'
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt'
import { createClient } from '@/utils/supabase/server'
import { toKatakana, toHiragana, getKanaRow } from '@/lib/utils/kana'
import { decryptOrFallback } from '@/utils/crypto/decryption-helper'
import { getCurrentDateJST } from '@/lib/utils/timezone'
import { calculateGrade, formatGradeLabel } from '@/utils/grade'

type ChildEntry = {
  id: string
  kanaName: string
  kanjiName: string
  gradeLabel?: string
  status: 'not_checked_in' | 'checked_in' | 'checked_out'
  checkedInAt?: string
  checkedOutAt?: string
}

export async function GET() {
  const metadata = await getAuthenticatedUserMetadata()
  if (!metadata) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { current_facility_id: facilityId } = metadata
  if (!facilityId) {
    return NextResponse.json({ error: 'No facility' }, { status: 404 })
  }

  const supabase = await createClient()
  const todayJST = getCurrentDateJST()
  const startOfDayUTC = new Date(`${todayJST}T00:00:00+09:00`).toISOString()
  const endOfDayUTC = new Date(`${todayJST}T23:59:59.999+09:00`).toISOString()

  // 在籍中の児童取得
  const { data: children, error } = await supabase
    .from('m_children')
    .select('id, family_name, given_name, family_name_kana, given_name_kana, grade_add, birth_date')
    .eq('facility_id', facilityId)
    .eq('enrollment_status', 'enrolled')
    .is('deleted_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 当日の出席レコード取得
  const childIds = children.map((c) => c.id)
  const { data: attendances, error: attendanceError } = await supabase
    .from('h_attendance')
    .select('child_id, checked_in_at, checked_out_at')
    .eq('facility_id', facilityId)
    .gte('checked_in_at', startOfDayUTC)
    .lte('checked_in_at', endOfDayUTC)
    .is('deleted_at', null)
    .in('child_id', childIds)

  if (attendanceError) {
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }

  const attendanceMap = new Map(attendances?.map((a) => [a.child_id, a]) ?? [])

  // 復号 + ステータス付与 + 50音行分類
  const groups: Record<string, ChildEntry[]> = {}

  for (const child of children) {
    const familyKana = decryptOrFallback(child.family_name_kana) ?? ''
    const givenKana = decryptOrFallback(child.given_name_kana) ?? ''
    const familyKanji = decryptOrFallback(child.family_name) ?? ''
    const givenKanji = decryptOrFallback(child.given_name) ?? ''

    const firstChar = toKatakana(familyKana).charAt(0)
    const row = getKanaRow(firstChar) ?? 'わ'

    const att = attendanceMap.get(child.id)
    const status: ChildEntry['status'] = !att
      ? 'not_checked_in'
      : att.checked_out_at
      ? 'checked_out'
      : 'checked_in'

    const grade = calculateGrade(child.birth_date, child.grade_add)
    const gradeLabel = formatGradeLabel(grade)

    if (!groups[row]) groups[row] = []
    groups[row].push({
      id: child.id,
      kanaName: toHiragana(`${familyKana} ${givenKana}`.trim()),
      kanjiName: `${familyKanji} ${givenKanji}`.trim(),
      gradeLabel: gradeLabel !== '-' ? gradeLabel : undefined,
      status,
      checkedInAt: att?.checked_in_at,
      checkedOutAt: att?.checked_out_at,
    })
  }

  // 各行をカナ順にソート
  for (const row of Object.keys(groups)) {
    groups[row].sort((a, b) => a.kanaName.localeCompare(b.kanaName, 'ja'))
  }

  return NextResponse.json({ groups })
}
