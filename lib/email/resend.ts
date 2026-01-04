import { BAD_REQUEST_MESSAGE, EmailRequestBody, EmailSendResult } from "./types"
import { buildEmailPayload } from "./utils"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL
const RESEND_ENDPOINT = "https://api.resend.com/emails"

type ResendResponseBody = {
  id?: string
  error?: { message?: string }
  message?: string
}

export const sendWithResend = async (rawBody: EmailRequestBody): Promise<EmailSendResult> => {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    throw new Error("メール送信設定が未完了です。RESEND_API_KEYとRESEND_FROM_EMAILを確認してください。")
  }

  const payload = buildEmailPayload(rawBody)

  const resendBody = {
    from: payload.senderName ? `${payload.senderName} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL,
    to: payload.to,
    cc: payload.cc?.length ? payload.cc : undefined,
    bcc: payload.bcc?.length ? payload.bcc : undefined,
    subject: payload.subject,
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

  return {
    ok: true,
    id: body?.id ?? null,
    message: "sent",
  }
}

export const isBadRequestError = (error: unknown) => error instanceof Error && error.message === BAD_REQUEST_MESSAGE
