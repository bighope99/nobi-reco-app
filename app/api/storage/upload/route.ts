import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { getUserSession } from '@/lib/auth/session'

const BUCKET_NAME = 'activity-photos'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const getExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

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
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: '画像形式はJPEG/PNG/WEBPのみ対応しています' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '画像ファイルのサイズが大きすぎます（最大5MB）' },
        { status: 413 }
      )
    }

    const fileId = randomUUID()
    const extension = getExtension(file.type)
    const filePath = `${session.current_facility_id}/${activityDate}/${fileId}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: '写真のアップロードに失敗しました' },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    return NextResponse.json({
      success: true,
      data: {
        file_id: fileId,
        file_path: filePath,
        url: publicUrl,
        thumbnail_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        caption: typeof caption === 'string' && caption.trim() ? caption.trim() : null,
        uploaded_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
