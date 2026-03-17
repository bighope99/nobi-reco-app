import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { buildPasswordResetEmailHtml } from '@/lib/email/templates';
import { sendWithGas } from '@/lib/email/gas';

/**
 * インメモリレート制限
 * 同一メールアドレスに対して RATE_LIMIT_WINDOW_MS 以内に RATE_LIMIT_MAX_REQUESTS 回まで
 */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5分
const RATE_LIMIT_MAX_REQUESTS = 3; // 5分間に3回まで

/** @internal テスト用にエクスポート */
export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

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

    // レート制限チェック（メールアドレスベース）
    if (!checkRateLimit(trimmedEmail)) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再度お試しください。' },
        { status: 429 }
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
