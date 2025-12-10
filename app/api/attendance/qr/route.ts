import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { getUserSession } from '@/lib/auth/session';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session?.facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { facility_id } = session;
    const { expires_in_minutes = 30 } = await request.json().catch(() => ({}));

    // Generate JWT token
    const issued_at = new Date();
    const expires_at = new Date(issued_at.getTime() + expires_in_minutes * 60 * 1000);

    const token = jwt.sign(
      {
        facility_id,
        issued_at: issued_at.toISOString(),
        expires_at: expires_at.toISOString(),
      },
      JWT_SECRET,
      { expiresIn: `${expires_in_minutes}m` }
    );

    // Generate QR code as SVG
    const qrCodeSvg = await QRCode.toString(token, {
      type: 'svg',
      width: 300,
      margin: 2,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        qr_code_svg: qrCodeSvg,
        facility_id,
        issued_at: issued_at.toISOString(),
        expires_at: expires_at.toISOString(),
        expires_in_minutes,
      },
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
