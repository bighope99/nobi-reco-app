import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

type RecipientInput = string | string[] | undefined

type EmailPayload = {
  to: RecipientInput
  cc?: RecipientInput
  bcc?: RecipientInput
  senderName?: string
  subject?: string
  htmlBody: string
  replyTo?: string
}

type ResendResponseBody = {
  id?: string
  error?: { message?: string }
  message?: string
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL
const RESEND_ENDPOINT = "https://api.resend.com/emails"
const DEFAULT_SUBJECT = "(no subject)"
const DEFAULT_HTML_BODY =
  "<p>このメールはResendの接続確認用に送信されています。</p><p>受信できたらメール配信機能の準備は完了です。</p>"
const BAD_REQUEST_MESSAGE = "to と htmlBody は必須です"

const normalizeRecipients = (value: RecipientInput): string[] => {
  if (!value) return []

  const list = Array.isArray(value) ? value : value.split(/,|\n/)

  return list
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0)
}

const buildHtmlBody = (body: EmailPayload & { email?: string; text?: string }): string => {
  const html = typeof body?.htmlBody === "string" ? body.htmlBody.trim() : ""
  if (html) return html

  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (text) return `<p>${text}</p>`

  return DEFAULT_HTML_BODY
}

const sendWithResend = async (payload: EmailPayload) => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error("メール送信設定が未完了です。RESEND_API_KEYとRESEND_FROM_EMAILを確認してください。")
  }

  const to = normalizeRecipients(payload.to)
  if (to.length === 0) {
    throw new Error(BAD_REQUEST_MESSAGE)
  }

  const cc = normalizeRecipients(payload.cc)
  const bcc = normalizeRecipients(payload.bcc)
  const subject = payload.subject?.trim() || DEFAULT_SUBJECT

  const resendBody = {
    from: payload.senderName ? `${payload.senderName} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL,
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    html: payload.htmlBody,
    reply_to: payload.replyTo,
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendBody),
  })

  const body = (await response.json().catch(() => null)) as ResendResponseBody | null

  if (!response.ok) {
    const errorMessage = body?.error?.message || body?.message || "メール送信に失敗しました。設定を確認してください。"
    throw new Error(errorMessage)
  }

  return body
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, ok: false, error: "認証が必要です。" }, { status: 401 })
    }

    const body = ((await request.json().catch(() => null)) || {}) as EmailPayload & {
      email?: string
      text?: string
    }

    const htmlBody = buildHtmlBody(body)
    const payload: EmailPayload = {
      to: body.to ?? body.email,
      cc: body.cc,
      bcc: body.bcc,
      senderName: body.senderName,
      subject: body.subject,
      htmlBody,
      replyTo: body.replyTo,
    }

    const toList = normalizeRecipients(payload.to)
    if (toList.length === 0 || !payload.htmlBody?.trim()) {
      return NextResponse.json({ success: false, ok: false, error: BAD_REQUEST_MESSAGE }, { status: 400 })
    }

    const responseBody = await sendWithResend(payload)

    return NextResponse.json({
      success: true,
      ok: true,
      data: { id: responseBody?.id ?? null },
      message: "sent",
    })
  } catch (error) {
    console.error("メール送信エラー", error)
    const message = error instanceof Error ? error.message : "内部エラーが発生しました。"

    const status = message === BAD_REQUEST_MESSAGE ? 400 : 500

    return NextResponse.json({ success: false, ok: false, error: message }, { status })
  }
}
