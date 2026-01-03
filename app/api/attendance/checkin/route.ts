import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface TokenPayload {
  facility_id: string;
  issued_at: string;
  expires_at: string;
}

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

    const { token: tokenRaw, child_id } = await request.json();
    let token: unknown = tokenRaw;

    if (!token || !child_id) {
      return NextResponse.json(
        { success: false, error: 'Token and child_id are required' },
        { status: 400 }
      );
    }

    // Handle array case: use first element if token is an array
    if (Array.isArray(token)) {
      if (token.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Token array is empty' },
          { status: 400 }
        );
      }
      token = token[0];
    }

    // Convert token to string
    const tokenString = String(token).trim();

    // Validate token format (JWT should have 3 parts separated by dots)
    if (tokenString.split('.').length !== 3) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 400 }
      );
    }

    // Verify JWT token
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(tokenString, JWT_SECRET) as TokenPayload;
    } catch (error: any) {
      if (error?.name === 'JsonWebTokenError') {
        return NextResponse.json(
          { success: false, error: 'Invalid or malformed token' },
          { status: 401 }
        );
      }
      if (error?.name === 'TokenExpiredError') {
        return NextResponse.json(
          { success: false, error: 'Token has expired' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify facility_id matches
    if (decoded.facility_id !== userSession.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility mismatch' },
        { status: 403 }
      );
    }

    // Check if child exists and belongs to facility, and get their class info
    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        _child_class!inner (
          class:m_classes!inner (
            id,
            name
          )
        )
      `)
      .eq('id', child_id)
      .eq('facility_id', userSession.current_facility_id)
      .eq('_child_class.is_current', true)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found' },
        { status: 404 }
      );
    }

    // Extract class name from the nested structure
    const className = child._child_class?.[0]?.class?.[0]?.name || 'クラス未設定';

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
