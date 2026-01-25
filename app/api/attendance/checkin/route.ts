import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { getQrSignatureSecret } from '@/lib/qr/secrets';
import { getCurrentDateJST } from '@/lib/utils/timezone';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { token: signatureRaw, child_id, facility_id: qrFacilityId } = await request.json();
    let signature: unknown = signatureRaw;

    if (!signature || !child_id) {
      return NextResponse.json(
        { success: false, error: 'Token and child_id are required' },
        { status: 400 }
      );
    }

    // Handle array case: use first element if signature is an array
    if (Array.isArray(signature)) {
      if (signature.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Signature array is empty' },
          { status: 400 }
        );
      }
      signature = signature[0];
    }

    // Convert signature to string
    const signatureString = String(signature).trim();

    // Validate signature format (HMAC-SHA256 should be 64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(signatureString)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature format' },
        { status: 400 }
      );
    }

    // Check if child exists and belongs to facility, and get their class info
    // Note: LEFT JOIN to allow children without class assignment
    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select(`
        id,
        facility_id,
        family_name,
        given_name,
        _child_class (
          class:m_classes (
            id,
            name
          )
        )
      `)
      .eq('id', child_id)
      .eq('facility_id', current_facility_id)
      .maybeSingle();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found or access denied' },
        { status: 404 }
      );
    }

    // Verify HMAC signature
    // Calculate expected signature: HMAC(child_id + facility_id + secret)
    const facilityIdForVerification = qrFacilityId || child.facility_id;

    // Verify facility_id matches (security check)
    if (qrFacilityId && qrFacilityId !== child.facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility ID mismatch' },
        { status: 403 }
      );
    }

    const qrSecret = getQrSignatureSecret();
    const expectedSignature = createHmac('sha256', qrSecret)
      .update(`${child_id}${facilityIdForVerification}${qrSecret}`)
      .digest('hex');

    // Verify signature matches using constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signatureString, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    // Check lengths match first (constant-time length check)
    if (signatureBuffer.length !== expectedBuffer.length) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Use constant-time comparison
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Extract class name from the nested structure
    // Prioritize current class (is_current = true), fallback to first class, or 'クラス未設定'
    // Note: class can be either an object or array depending on Supabase relationship structure
    const currentClass = child._child_class?.find((cc: any) => cc.is_current === true);
    const getClassName = (cc: any) => {
      if (!cc?.class) return null;
      // Handle both array and object cases
      if (Array.isArray(cc.class)) {
        return cc.class[0]?.name;
      }
      return cc.class.name;
    };
    const className = getClassName(currentClass) 
      || (child._child_class?.[0] ? getClassName(child._child_class[0]) : null)
      || 'クラス未設定';

    const now = new Date();
    const today = getCurrentDateJST(); // JST日付 (YYYY-MM-DD)
    // JSTベースの範囲をUTCに変換して検索
    const startOfDayUTC = new Date(`${today}T00:00:00+09:00`).toISOString();
    const endOfDayUTC = new Date(`${today}T23:59:59.999+09:00`).toISOString();

    // Check if already checked in today
    const { data: existing } = await supabase
      .from('h_attendance')
      .select('id, checked_in_at')
      .eq('child_id', child_id)
      .eq('facility_id', current_facility_id)
      .gte('checked_in_at', startOfDayUTC)
      .lte('checked_in_at', endOfDayUTC)
      .order('checked_in_at', { ascending: true })
      .maybeSingle();

    // If already checked in today, return success without saving (idempotent behavior)
    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          child_id,
          child_name: `${child.family_name} ${child.given_name}`,
          class_name: className,
          checked_in_at: existing.checked_in_at,
          attendance_date: today,
          already_checked_in: true, // Flag to indicate this was already checked in
        },
      });
    }

    // Create attendance record
    const { data: attendance, error: insertError } = await supabase
      .from('h_attendance')
      .insert({
        child_id,
        facility_id: current_facility_id,
        checked_in_at: now.toISOString(),
        check_in_method: 'qr',
      })
      .select()
      .single();

    if (insertError) {
      // Check if error is due to duplicate (race condition or unique constraint violation)
      // PostgreSQL error code 23505 = unique_violation
      const isDuplicateError = insertError.code === '23505' || 
                               insertError.message?.includes('duplicate') ||
                               insertError.message?.includes('unique');
      
      if (isDuplicateError) {
        // Fetch existing record for today
        const { data: existingAttendance } = await supabase
          .from('h_attendance')
          .select('id, checked_in_at')
          .eq('child_id', child_id)
          .eq('facility_id', current_facility_id)
          .gte('checked_in_at', startOfDayUTC)
          .lte('checked_in_at', endOfDayUTC)
          .order('checked_in_at', { ascending: true })
          .maybeSingle();

        // If duplicate error but record exists, return success (idempotent behavior)
        if (existingAttendance) {
          return NextResponse.json({
            success: true,
            data: {
              child_id,
              child_name: `${child.family_name} ${child.given_name}`,
              class_name: className,
              checked_in_at: existingAttendance.checked_in_at,
              attendance_date: today,
              already_checked_in: true, // Flag to indicate this was already checked in
            },
          });
        }
      }

      console.error('Attendance insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to record attendance' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        child_id,
        child_name: `${child.family_name} ${child.given_name}`,
        class_name: className,
        checked_in_at: attendance.checked_in_at,
        attendance_date: today,
      },
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process check-in' },
      { status: 500 }
    );
  }
}
