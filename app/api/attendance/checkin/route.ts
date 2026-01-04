import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { getQrSignatureSecret } from '@/lib/qr/secrets';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session: authSession }, error: authError } = await supabase.auth.getSession();
    if (authError || !authSession) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // セッション情報取得
    const userSession = await getUserSession(authSession.user.id);
    if (!userSession?.current_facility_id) {
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
      .eq('facility_id', userSession.current_facility_id)
      .maybeSingle();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found or access denied' },
        { status: 404 }
      );
    }

    // Verify HMAC signature
    // Calculate expected signature: HMAC(child_id + facility_id + secret)
    // Note: Must match the exact same string concatenation used in createQrPayload
    // Use facility_id from QR code payload if provided, otherwise use DB value
    // This ensures we verify against the same facility_id used to generate the signature
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
    const today = now.toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59.999`;

    // Check if already checked in today
    const { data: existing } = await supabase
      .from('h_attendance')
      .select('id, checked_in_at')
      .eq('child_id', child_id)
      .eq('facility_id', userSession.current_facility_id)
      .gte('checked_in_at', startOfDay)
      .lte('checked_in_at', endOfDay)
      .order('checked_in_at', { ascending: true })
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Already checked in today',
          data: {
            child_id,
            child_name: `${child.family_name} ${child.given_name}`,
            class_name: className,
            checked_in_at: existing.checked_in_at,
          },
        },
        { status: 409 }
      );
    }

    // Create attendance record
    const { data: attendance, error: insertError } = await supabase
      .from('h_attendance')
      .insert({
        child_id,
        facility_id: userSession.current_facility_id,
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
          .eq('facility_id', userSession.current_facility_id)
          .gte('checked_in_at', startOfDay)
          .lte('checked_in_at', endOfDay)
          .order('checked_in_at', { ascending: true })
          .maybeSingle();

        if (existingAttendance) {
          return NextResponse.json(
            {
              success: false,
              error: 'Already checked in today',
              data: {
                child_id,
                child_name: `${child.family_name} ${child.given_name}`,
                class_name: className,
                checked_in_at: existingAttendance.checked_in_at,
              },
            },
            { status: 409 }
          );
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
