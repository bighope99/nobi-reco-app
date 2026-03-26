import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SIGNED_URL_EXPIRES_IN = 300

export interface UploadOptions {
  bucketName: string
  filePath: string
  file: File
  caption?: string
}

export interface UploadResult {
  file_id: string
  file_path: string
  url: string
  thumbnail_url: string
  file_size: number
  mime_type: string
  caption: string | null
  expires_in: number
  uploaded_at: string
}

export function getExtension(mimeType: string): string {
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

/**
 * ファイルのバリデーション（MIME・サイズ）
 * 無効な場合は Error をthrow する
 */
export function validateFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('画像形式はJPEG/PNG/WEBPのみ対応しています')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('画像ファイルのサイズが大きすぎます（最大5MB）')
  }
}

/**
 * Supabase Storage への署名付きアップロード共通処理
 * 1. createSignedUploadUrl でアップロード用トークン取得
 * 2. uploadToSignedUrl でアップロード実行
 * 3. createSignedUrl でアクセス用署名URLを生成して返す
 */
export async function uploadToStorage(
  supabase: SupabaseClient,
  options: UploadOptions
): Promise<UploadResult> {
  const { bucketName, filePath, file, caption } = options
  const fileId = randomUUID()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { data: signedUpload, error: signedUploadError } = await supabase.storage
    .from(bucketName)
    .createSignedUploadUrl(filePath)

  if (signedUploadError || !signedUpload) {
    console.error('Signed upload URL error:', signedUploadError)
    throw new Error('写真のアップロードに失敗しました')
  }

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    throw new Error('写真のアップロードに失敗しました')
  }

  const { data: signedAccess, error: signedAccessError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRES_IN)

  if (signedAccessError || !signedAccess) {
    console.error('Signed access URL error:', signedAccessError)
    throw new Error('写真URLの生成に失敗しました')
  }

  return {
    file_id: fileId,
    file_path: filePath,
    url: signedAccess.signedUrl,
    thumbnail_url: signedAccess.signedUrl,
    file_size: file.size,
    mime_type: file.type,
    caption: typeof caption === 'string' && caption.trim() ? caption.trim() : null,
    expires_in: SIGNED_URL_EXPIRES_IN,
    uploaded_at: new Date().toISOString(),
  }
}
