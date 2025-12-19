import { BAD_REQUEST_MESSAGE, DEFAULT_HTML_BODY, DEFAULT_SUBJECT, EmailPayload, EmailRequestBody, RecipientInput } from "./types"

export const normalizeRecipients = (value: RecipientInput): string[] => {
  if (!value) return []

  const list = Array.isArray(value) ? value : value.split(/,|\n/)

  return list
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0)
}

const buildHtmlBody = (body: EmailRequestBody): string => {
  const html = typeof body?.htmlBody === "string" ? body.htmlBody.trim() : ""
  if (html) return html

  const text = typeof body?.text === "string" ? body.text.trim() : ""
  if (text) return `<p>${text}</p>`

  return DEFAULT_HTML_BODY
}

export const buildEmailPayload = (raw: EmailRequestBody): EmailPayload => {
  const payload: EmailPayload = {
    to: normalizeRecipients(raw.to ?? raw.email),
    cc: normalizeRecipients(raw.cc),
    bcc: normalizeRecipients(raw.bcc),
    senderName: raw.senderName,
    subject: raw.subject?.trim() || DEFAULT_SUBJECT,
    htmlBody: buildHtmlBody(raw),
    replyTo: raw.replyTo,
  }

  if (payload.to.length === 0 || !payload.htmlBody.trim()) {
    throw new Error(BAD_REQUEST_MESSAGE)
  }

  return payload
}
