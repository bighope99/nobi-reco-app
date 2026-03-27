import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

const BUCKET_NAME = 'guardian-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SIGNED_URL_EXPIRES_IN = 3600;

// Simple in-memory rate limiter (resets on server restart)
const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function checkRateLimit(facilityId: string): boolean {
  const now = Date.now();
  const entry = uploadRateLimit.get(facilityId);
  if (!entry || now > entry.resetAt) {
    uploadRateLimit.set(facilityId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const getExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    default: return 'bin';
  }
};

// POST /api/guardians/upload-photo
// multipart/form-data: file, guardian_id (optional)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 401 });
    }

    if (!checkRateLimit(current_facility_id)) {
      return NextResponse.json(
        { success: false, error: 'アップロード回数の上限に達しました。しばらく経ってからお試しください。' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: '画像形式はJPEG/PNG/WEBPのみ対応しています' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '画像ファイルのサイズが大きすぎます（最大5MB）' },
        { status: 413 }
      );
    }

    const fileId = randomUUID();
    const extension = getExtension(file.type);
    const filePath = `${current_facility_id}/${fileId}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data: signedUpload, error: signedUploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (signedUploadError || !signedUpload) {
      console.error('Signed upload URL error:', signedUploadError);
      return NextResponse.json(
        { success: false, error: '写真のアップロードに失敗しました' },
        { status: 500 }
      );
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .uploadToSignedUrl(signedUpload.path, signedUpload.token, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: '写真のアップロードに失敗しました' },
        { status: 500 }
      );
    }

    const { data: signedAccess, error: signedAccessError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRES_IN);

    if (signedAccessError || !signedAccess) {
      console.error('Signed access URL error:', signedAccessError);
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return NextResponse.json(
        { success: false, error: '写真URLの生成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        file_path: filePath,
        url: signedAccess.signedUrl,
      },
    });
  } catch (error) {
    console.error('Guardian photo upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/guardians/upload-photo?path=... — 未保存写真の削除
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    if (!filePath || !filePath.startsWith(`${current_facility_id}/`)) {
      return NextResponse.json({ success: false, error: '無効なパスです' }, { status: 400 });
    }
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Guardian photo delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
