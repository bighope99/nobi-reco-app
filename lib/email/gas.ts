import { BAD_REQUEST_MESSAGE, EmailRequestBody, EmailSendResult } from "./types"
import { buildEmailPayload } from "./utils"

const sendGasTestEmail = async (payload: EmailRequestBody) => {
  const endpoint = process.env.GAS_EMAIL_API_URL
  if (!endpoint) {
    throw new Error("メール送信エンドポイントが設定されていません")
  }

  const normalized = buildEmailPayload(payload)

  const body = {
    to: normalized.to,
    cc: normalized.cc?.length ? normalized.cc : undefined,
    bcc: normalized.bcc?.length ? normalized.bcc : undefined,
    senderName: normalized.senderName,
    subject: normalized.subject,
    htmlBody: normalized.htmlBody,
    replyTo: normalized.replyTo,
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  let result: { ok: boolean; message?: string; error?: string } | null = null
  try {
    result = (await response.json()) as { ok: boolean; message?: string; error?: string }
  } catch (error) {
    // 非JSONの場合は null のまま扱う
  }

  if (!response.ok || !result?.ok) {
    const errorMessage = result?.error || `メール送信に失敗しました (status: ${response.status})`
    throw new Error(errorMessage)
  }

  return result
}

export const sendWithGas = async (rawBody: EmailRequestBody): Promise<EmailSendResult> => {
  const result = await sendGasTestEmail(rawBody)

  return {
    ok: result.ok,
    message: result.message ?? "sent",
  }
}

export const isBadRequestError = (error: unknown) => error instanceof Error && error.message === BAD_REQUEST_MESSAGE
