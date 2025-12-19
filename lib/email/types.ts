export type RecipientInput = string | string[] | undefined

export type EmailRequestBody = {
  to: RecipientInput
  cc?: RecipientInput
  bcc?: RecipientInput
  senderName?: string
  subject?: string
  htmlBody?: string
  replyTo?: string
  // Legacy fields for backward compatibility
  email?: string
  text?: string
}

export type EmailPayload = {
  to: string[]
  cc?: string[]
  bcc?: string[]
  senderName?: string
  subject: string
  htmlBody: string
  replyTo?: string
}

export type EmailSendResult = {
  ok: boolean
  message?: string
  id?: string | null
}

export const BAD_REQUEST_MESSAGE = "to と htmlBody は必須です"
export const DEFAULT_SUBJECT = "(no subject)"
export const DEFAULT_HTML_BODY =
  "<p>このメールはResendの接続確認用に送信されています。</p><p>受信できたらメール配信機能の準備は完了です。</p>"
