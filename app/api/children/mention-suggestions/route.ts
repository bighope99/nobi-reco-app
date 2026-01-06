import { NextRequest, NextResponse } from 'next/server'

import { getUserSession } from '@/lib/auth/session'
import { calculateGrade, formatGradeLabel } from '@/utils/grade'
import { createClient } from '@/utils/supabase/server'
import { decryptPII } from '@/utils/crypto/piiEncryption'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('class_id')
  const query = searchParams.get('query')?.trim() || ''
  const limit = Number(searchParams.get('limit')) || 20

  if (!classId) {
    return NextResponse.json({ success: false, error: 'class_id is required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userSession = await getUserSession(session.user.id)
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }

    const facility_id = userSession.current_facility_id

    let childrenQuery = supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        nickname,
        birth_date,
        grade_add,
        photo_url,
        _child_class!inner (
          class_id,
          is_current,
          m_classes (
            name
          )
        )
      `)
      .eq('facility_id', facility_id)
      .eq('_child_class.class_id', classId)
      .eq('_child_class.is_current', true)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null)
      .limit(limit)
      .order('family_name_kana', { ascending: true })

    if (query) {
      childrenQuery = childrenQuery.or(
        `family_name.ilike.%${query}%,given_name.ilike.%${query}%,family_name_kana.ilike.%${query}%,given_name_kana.ilike.%${query}%,nickname.ilike.%${query}%`,
      )
    }

    const { data: children, error: childrenError } = await childrenQuery

    if (childrenError) {
      console.error('Mention suggestions children fetch error:', childrenError)
      return NextResponse.json(
        { success: false, error: 'メンション候補の取得に失敗しました' },
        { status: 500 },
      )
    }

    // PIIフィールドを復号化（失敗時は平文として扱う - 後方互換性）
    const decryptOrFallback = (encrypted: string | null | undefined): string | null => {
      if (!encrypted) return null;
      const decrypted = decryptPII(encrypted);
      return decrypted !== null ? decrypted : encrypted;
    };

    const suggestions = (children || []).map((child) => {
      const decryptedFamilyName = decryptOrFallback(child.family_name);
      const decryptedGivenName = decryptOrFallback(child.given_name);
      const decryptedFamilyNameKana = decryptOrFallback(child.family_name_kana);
      const decryptedGivenNameKana = decryptOrFallback(child.given_name_kana);
      const name = `${decryptedFamilyName} ${decryptedGivenName}`
      const kana = `${decryptedFamilyNameKana} ${decryptedGivenNameKana}`
      const grade = calculateGrade(child.birth_date, child.grade_add)
      const gradeLabel = formatGradeLabel(grade)
      const className = child._child_class?.[0]?.m_classes?.name || ''

      return {
        child_id: child.id,
        name,
        kana,
        nickname: child.nickname,
        grade: gradeLabel,
        class_id: child._child_class?.[0]?.class_id,
        class_name: className,
        photo_url: child.photo_url,
        display_name: gradeLabel ? `${name}（${gradeLabel}・${className}）` : `${name}（${className}）`,
        unique_key: `${child.id}-${child._child_class?.[0]?.class_id ?? ''}`,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestions,
      },
    })
  } catch (error) {
    console.error('Mention suggestions API Error:', error)
    return NextResponse.json({ success: false, error: 'メンション候補の取得に失敗しました' }, { status: 500 })
  }
}
