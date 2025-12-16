import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession, type UserSession } from '@/lib/auth/session';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

let createSupabaseClient = createClient;
let getUserSessionFn = getUserSession;

export function __setTestSupabaseClient(fn: typeof createClient) {
  createSupabaseClient = fn;
}

export function __setTestUserSession(fn: typeof getUserSession) {
  getUserSessionFn = fn;
}

export function __resetTestOverrides() {
  createSupabaseClient = createClient;
  getUserSessionFn = getUserSession;
}

function validateDate(activityDate: string | null) {
  if (!activityDate || typeof activityDate !== 'string') {
    return false;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(activityDate);
}

function buildStoragePath(facilityId: string, activityDate: string, filename: string) {
  const extension = filename.includes('.') ? filename.split('.').pop() : 'jpg';
  return `${facilityId}/${activityDate}/${crypto.randomUUID()}.${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userSession: UserSession | null = await getUserSessionFn(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found in session' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const activityDate = formData.get('activity_date') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!(file instanceof File) || !validateDate(activityDate)) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'INVALID_FILE_TYPE' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'FILE_TOO_LARGE' }, { status: 413 });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'activity-photos';
    const path = buildStoragePath(userSession.current_facility_id, activityDate, file.name || 'activity.jpg');

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });

    if (uploadError || !data) {
      console.error('Supabase storage upload error:', uploadError);
      return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    const publicUrl = publicUrlData?.publicUrl || '';

    return NextResponse.json({
      success: true,
      data: {
        file_id: data.path,
        url: publicUrl,
        thumbnail_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        caption: caption || undefined,
        uploaded_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Unexpected error in /api/storage/upload:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
