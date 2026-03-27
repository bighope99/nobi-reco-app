import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { hasCompletedPasswordSetup } from '@/lib/auth/password-status';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';

/**
 * POST /api/users/:id/resend-invitation
 * 認証メール再送
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createClient();

    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, company_id } = metadata;

    // 権限チェック（facility_admin以上のみ）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id: targetUserId } = params;

    // 対象ユーザーの確認
    const { data: targetUser, error: targetUserError } = await supabase
      .from('m_users')
      .select('id, name, email, role, company_id')
      .eq('id', targetUserId)
      .eq('company_id', company_id)
      .is('deleted_at', null)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // メールアドレスがないユーザーには送信不可
    if (!targetUser.email) {
      return NextResponse.json(
        { success: false, error: 'このユーザーにはメールアドレスが設定されていません' },
        { status: 400 }
      );
    }

    // パスワード設定済みか確認
    const supabaseAdmin = await createAdminClient();
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(targetUserId);

    if (!authUserData?.user) {
      return NextResponse.json(
        { success: false, error: 'Auth user not found' },
        { status: 404 }
      );
    }

    if (hasCompletedPasswordSetup(authUserData.user)) {
      return NextResponse.json(
        { success: false, error: 'このユーザーは既にパスワード設定済みです' },
        { status: 400 }
      );
    }

    // 招待リンク生成
    const reinviteLinkType = authUserData.user.email_confirmed_at ? 'magiclink' : 'invite';

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: reinviteLinkType,
      email: targetUser.email,
    });

    if (linkError || !linkData) {
      throw linkError || new Error('Failed to generate invite link');
    }

    // トークンハッシュ抽出
    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link for resend, user:', targetUserId);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    // パスワード設定ページURL構築
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // メール送信
    await sendWithGas({
      to: targetUser.email,
      subject: '【のびレコ】アカウント登録のご案内',
      htmlBody: buildUserInvitationEmailHtml({
        userName: targetUser.name,
        userEmail: targetUser.email,
        role: targetUser.role,
        inviteUrl,
      }),
      senderName: 'のびレコ',
    });

    return NextResponse.json({
      success: true,
      message: '認証メールを再送信しました',
    });
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
