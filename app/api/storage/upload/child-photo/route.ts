import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt'
import { validateFile, uploadToStorage, getExtension } from '@/lib/storage/upload'

// Private bucket for child photos. URLs are signed and short-lived.
const BUCKET_NAME = 'private-child-photos'
// NOTE: Storage policies must restrict this bucket to facility-scoped staff access.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata()
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { current_facility_id } = metadata
    if (!current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const childId = formData.get('child_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 })
    }
    if (typeof childId !== 'string' || childId.trim() === '') {
      return NextResponse.json({ success: false, error: 'child_id is required' }, { status: 400 })
    }

    try {
      validateFile(file)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid file'
      const status = message.includes('サイズ') ? 413 : 400
      return NextResponse.json({ success: false, error: message }, { status })
    }

    const extension = getExtension(file.type)
    // child_id をパスに使うことで更新時に同じパスへ upsert される
    const filePath = `${current_facility_id}/children/${childId.trim()}.${extension}`

    try {
      const result = await uploadToStorage(supabase, {
        bucketName: BUCKET_NAME,
        filePath,
        file,
      })

      return NextResponse.json({ success: true, data: result })
    } catch (err) {
      const message = err instanceof Error ? err.message : '写真のアップロードに失敗しました'
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  } catch (error) {
    console.error('Child photo upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
