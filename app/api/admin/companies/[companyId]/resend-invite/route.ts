import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';

/**
 * POST /api/admin/companies/[companyId]/resend-invite
 * 会社代表者への招待メール再送信（site_adminのみ）
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ companyId: string }> }
) {
  try {
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // site_admin権限チェック
    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Next.js 15: params を await で取得
    const { companyId } = await props.params;

    const supabase = await createClient();

    // 会社の存在確認
    const { data: company, error: companyError } = await supabase
      .from('m_companies')
      .select('id, name')
      .eq('id', companyId)
      .is('deleted_at', null)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 会社の代表者（company_admin）を取得
    const { data: adminUser, error: adminUserError } = await supabase
      .from('m_users')
      .select('id, name, email, role')
      .eq('company_id', companyId)
      .eq('role', 'company_admin')
      .is('deleted_at', null)
      .single();

    if (adminUserError || !adminUser) {
      return NextResponse.json(
        { success: false, error: 'Company admin not found' },
        { status: 404 }
      );
    }

    // 代表者が所属する施設を取得（メール本文用）
    const { data: userFacility } = await supabase
      .from('_user_facility')
      .select('facility_id')
      .eq('user_id', adminUser.id)
      .eq('is_current', true)
      .single();

    let facilityName: string | undefined;
    if (userFacility) {
      const { data: facility } = await supabase
        .from('m_facilities')
        .select('name')
        .eq('id', userFacility.facility_id)
        .single();
      facilityName = facility?.name;
    }

    // 招待リンクを再生成
    const supabaseAdmin = await createAdminClient();

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: adminUser.email,
    });

    if (linkError || !linkData) {
      throw linkError || new Error('Failed to generate invite link');
    }

    // トークンハッシュの抽出
    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link:', supabaseUrl);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate valid invite link',
          message: 'Token hash is missing from the generated link',
        },
        { status: 500 }
      );
    }

    // 招待URLの構築
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // 招待メール送信
    try {
      const emailHtml = buildUserInvitationEmailHtml({
        userName: adminUser.name,
        userEmail: adminUser.email,
        role: adminUser.role,
        companyName: company.name,
        facilityName,
        inviteUrl,
      });

      await sendWithGas({
        to: adminUser.email,
        subject: '【のびレコ】アカウント登録のご案内',
        htmlBody: emailHtml,
        senderName: 'のびレコ',
      });

      return NextResponse.json({
        success: true,
        message: '招待メールを再送信しました',
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send invitation email',
          message: emailError instanceof Error ? emailError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
