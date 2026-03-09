import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { buildPasswordResetEmailHtml } from '@/lib/email/templates';
import { sendWithGas } from '@/lib/email/gas';

/**
 * POST /api/auth/reset-password
 * パスワード再設定メールを送信する（認証不要）
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'メールアドレスを入力してください' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    // ユーザーの存在確認（セキュリティ：存在しなくても成功レスポンスを返す）
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('m_users')
      .select('id, name, email')
      .eq('email', trimmedEmail)
      .is('deleted_at', null)
      .single();

    if (!user) {
      // ユーザーが存在しなくても成功レスポンスを返す（メール列挙攻撃防止）
      return NextResponse.json({ success: true });
    }

    // Supabase Admin APIでリカバリーリンクを生成
    const supabaseAdmin = await createAdminClient();
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: trimmedEmail,
      });

    if (linkError || !linkData) {
      console.error('Failed to generate recovery link:', linkError);
      return NextResponse.json(
        { error: 'リセットメールの送信に失敗しました' },
        { status: 500 }
      );
    }

    // リンクからトークンを抽出してアプリ内URLを構築
    const actionLink = linkData.properties.action_link;
    const urlObj = new URL(actionLink);
    const tokenHash =
      urlObj.searchParams.get('token_hash') ||
      urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'recovery';

    if (!tokenHash) {
      console.error('Failed to extract token from recovery link');
      return NextResponse.json(
        { error: 'リセットメールの送信に失敗しました' },
        { status: 500 }
      );
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const resetUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // パスワードリセットメール送信
    const emailHtml = buildPasswordResetEmailHtml({
      userName: user.name,
      resetUrl,
    });

    await sendWithGas({
      to: trimmedEmail,
      subject: '【のびレコ】パスワード再設定のご案内',
      htmlBody: emailHtml,
      senderName: 'のびレコ',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'リセットメールの送信に失敗しました' },
      { status: 500 }
    );
  }
}
