import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { getUserSession } from '@/lib/auth/session'
import { validateFile, uploadToStorage, getExtension } from '@/lib/storage/upload'

// Private bucket for activity photos. URLs are signed and short-lived.
const BUCKET_NAME = 'private-activity-photos'
// NOTE: Storage policies must restrict this bucket to facility-scoped staff access.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const session = await getUserSession(user.id)
    if (!session?.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const activityDate = formData.get('activity_date')
    const caption = formData.get('caption')

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 })
    }
    if (typeof activityDate !== 'string' || activityDate.trim() === '') {
      return NextResponse.json({ success: false, error: 'activity_date is required' }, { status: 400 })
    }

    try {
      validateFile(file)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid file'
      const status = message.includes('サイズ') ? 413 : 400
      return NextResponse.json({ success: false, error: message }, { status })
    }

    const fileId = randomUUID()
    const extension = getExtension(file.type)
    const filePath = `${session.current_facility_id}/${activityDate}/${fileId}.${extension}`
    const captionValue = typeof caption === 'string' ? caption : undefined

    try {
      const result = await uploadToStorage(supabase, {
        bucketName: BUCKET_NAME,
        filePath,
        file,
        caption: captionValue,
      }, fileId)
      return NextResponse.json({ success: true, data: result })
    } catch (err) {
      const message = err instanceof Error ? err.message : '写真のアップロードに失敗しました'
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  } catch (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
