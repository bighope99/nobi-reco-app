import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth/session'
import { getServerSession } from '@/lib/auth/server-session'
import { createQrPayload, createQrPdf, formatFileSegment } from '@/lib/qr/card-generator'

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const childId = params.id

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

    const { data: facilityData, error: facilityError } = await supabase
      .from('m_facilities')
      .select('name')
      .eq('id', facilityId)
      .single()

    if (facilityError || !facilityData) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 })
    }

    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name, facility_id')
      .eq('id', childId)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .single()

    if (childError || !childData) {
      return NextResponse.json({ success: false, error: 'Child not found' }, { status: 404 })
    }

    const childName = `${childData.family_name} ${childData.given_name}`.trim()

    const { payload } = createQrPayload(childData.id, facilityId)
    const pdfBuffer = createQrPdf({
      childName,
      facilityName: facilityData.name,
      payload,
    })

    const filename = `${formatFileSegment(childName)}_${childData.id}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('QR PDF generation error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate QR PDF' }, { status: 500 })
  }
}
