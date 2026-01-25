import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserSession } from '@/lib/auth/session'
import { createQrPayload, createQrPdf, createZip, formatFileSegment } from '@/lib/qr/card-generator'
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper'

interface BatchRequestBody {
  child_ids?: string[]
}

interface ChildDataRow {
  id: string
  family_name: string
  given_name: string
  facility_id: string
}

// 大量PDF生成時のタイムアウト対策
export const maxDuration = 60

// メモリ使用量を抑えるための並行度制限
const CONCURRENT_LIMIT = 5

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userSession = await getUserSession(session.user.id)
    const facilityId = userSession?.current_facility_id

    if (!facilityId) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 })
    }

    const { child_ids: childIds }: BatchRequestBody = await request.json().catch(() => ({}))

    if (!Array.isArray(childIds) || childIds.length === 0) {
      return NextResponse.json({ success: false, error: 'child_ids is required' }, { status: 400 })
    }

    const { data: facilityData, error: facilityError } = await supabase
      .from('m_facilities')
      .select('name')
      .eq('id', facilityId)
      .single()

    if (facilityError || !facilityData) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 })
    }

    const { data: childrenData, error: childrenError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name, facility_id')
      .in('id', childIds)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)

    if (childrenError) {
      console.error('Failed to load children for QR batch:', childrenError)
      return NextResponse.json({ success: false, error: 'Failed to load children' }, { status: 500 })
    }

    if (!childrenData || childrenData.length === 0) {
      return NextResponse.json({ success: false, error: 'Children not found' }, { status: 404 })
    }

    const generatedAt = new Date()

    // チャンク処理でメモリ使用量を抑制
    const entries: { filename: string; content: Buffer }[] = []
    for (let i = 0; i < childrenData.length; i += CONCURRENT_LIMIT) {
      const chunk = childrenData.slice(i, i + CONCURRENT_LIMIT)
      const chunkEntries = await Promise.all(
        chunk.map(async (child: ChildDataRow) => {
          // PIIフィールドを復号化（失敗時は平文として扱う - 後方互換性）
          const decryptedFamilyName = decryptOrFallback(child.family_name)
          const decryptedGivenName = decryptOrFallback(child.given_name)
          const childName = `${decryptedFamilyName ?? ''} ${decryptedGivenName ?? ''}`.trim()
          const { payload } = createQrPayload(child.id, facilityId)
          const pdfBuffer = await createQrPdf({
            childName,
            facilityName: facilityData.name,
            payload,
          })

          const filename = `${formatFileSegment(childName)}_${child.id}.pdf`

          return {
            filename,
            content: pdfBuffer,
          }
        })
      )
      entries.push(...chunkEntries)
    }

    const zipBuffer = createZip(entries)
    const dateSegment = generatedAt.toISOString().slice(0, 10).replace(/-/g, '')
    const zipName = `qr_codes_${formatFileSegment(facilityData.name)}_${dateSegment}.zip`

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    })
  } catch (error) {
    console.error('QR batch generation error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate QR bundle' }, { status: 500 })
  }
}

