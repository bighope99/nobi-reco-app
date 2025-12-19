import { NextRequest, NextResponse } from 'next/server'
type RecipientInput = string | string[] | undefined

type GasEmailRequest = {
  to: RecipientInput
  cc?: RecipientInput
  bcc?: RecipientInput
  senderName?: string
  subject?: string
  htmlBody: string
  replyTo?: string
}

type GasEmailResponse = {
  ok: boolean
  message?: string
  error?: string
}

const DEFAULT_SUBJECT = '(no subject)'
const BAD_REQUEST_MESSAGE = 'to と htmlBody は必須です'

const normalizeRecipients = (value: RecipientInput): string[] => {
  if (!value) return []

  const list = Array.isArray(value) ? value : value.split(/,|\n/)

  return list
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0)
}

const sendGasTestEmail = async (payload: GasEmailRequest): Promise<GasEmailResponse> => {
  const endpoint = process.env.GAS_EMAIL_API_URL
  if (!endpoint) {
    throw new Error('メール送信エンドポイントが設定されていません')
  }

  const to = normalizeRecipients(payload.to)
  if (to.length === 0) {
    throw new Error('宛先は必須です')
  }

  const cc = normalizeRecipients(payload.cc)
  const bcc = normalizeRecipients(payload.bcc)
  const subject = payload.subject?.trim() || DEFAULT_SUBJECT

  const body = {
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    senderName: payload.senderName,
    subject,
    htmlBody: payload.htmlBody,
    replyTo: payload.replyTo,
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let result: GasEmailResponse | null = null
  try {
    result = (await response.json()) as GasEmailResponse
  } catch (error) {
    // JSON以外のレスポンスは null のまま扱う
  }

  if (!response.ok || !result?.ok) {
    const errorMessage = result?.error || `メール送信に失敗しました (status: ${response.status})`
    throw new Error(errorMessage)
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GasEmailRequest

    if (!body?.to || !body?.htmlBody) {
      return NextResponse.json({ ok: false, error: BAD_REQUEST_MESSAGE }, { status: 400 })
    }

    const payload: GasEmailRequest = {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      senderName: body.senderName,
      subject: body.subject,
      htmlBody: body.htmlBody,
      replyTo: body.replyTo,
    }

    const result = await sendGasTestEmail(payload)

    return NextResponse.json({
      ok: result.ok,
      message: result.message ?? 'sent',
    })
  } catch (error) {
    console.error('メール送信テストエラー', error)
    const message = error instanceof Error ? error.message : 'メール送信に失敗しました'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
