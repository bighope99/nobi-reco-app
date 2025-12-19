import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL
const RESEND_ENDPOINT = "https://api.resend.com/emails"
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: "メール送信設定が未完了です。RESEND_API_KEYとRESEND_FROM_EMAILを確認してください。",
        },
        { status: 500 },
      )
    }

    const supabase = await createClient()
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: "認証が必要です。" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const email = typeof body?.email === "string" ? body.email.trim() : ""
    const senderName = typeof body?.senderName === "string" ? body.senderName.trim() : ""
    const customText = typeof body?.text === "string" ? body.text.trim() : ""

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "有効なメールアドレスを入力してください。" },
        { status: 400 },
      )
    }

    const fromAddress = senderName ? `${senderName} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL
    const messageBody =
      customText ||
      [
        "このメールはResendの接続確認用に送信されています。",
        "受信できたらメール配信機能の準備は完了です。",
      ].join("\n")

    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: "のびレコ メール送信テスト",
        text: messageBody,
      }),
    })

    const responseBody = await resendResponse.json().catch(() => null)

    if (!resendResponse.ok) {
      console.error("Resend API error", {
        status: resendResponse.status,
        errorMessage: responseBody?.error?.message || responseBody?.message || "unknown_error",
      })

      return NextResponse.json(
        { success: false, error: "メール送信に失敗しました。設定を確認してください。" },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      data: { id: responseBody?.id ?? null },
    })
  } catch (error) {
    console.error("Email send error", error)

    return NextResponse.json(
      { success: false, error: "内部エラーが発生しました。" },
      { status: 500 },
    )
  }
}
