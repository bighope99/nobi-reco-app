import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth/session'
import { getServerSession } from '@/lib/auth/server-session'
import { createQrPayload, createQrPdf, createZip, formatFileSegment } from '@/lib/qr/card-generator'

interface BatchRequestBody {
  child_ids?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await getServerSession()
    if ('errorResponse' in sessionResult) {
      return sessionResult.errorResponse
    }

    const { supabase, session } = sessionResult

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
    const entries = childrenData.map((child: any) => {
      const childName = `${child.family_name} ${child.given_name}`.trim()
      const { payload } = createQrPayload(child.id, facilityId)
      const pdfBuffer = createQrPdf({
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

    const zipBuffer = createZip(entries)
    const dateSegment = generatedAt.toISOString().slice(0, 10).replace(/-/g, '')
    const zipName = `qr_codes_${formatFileSegment(facilityData.name)}_${dateSegment}.zip`

    return new NextResponse(zipBuffer, {
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
