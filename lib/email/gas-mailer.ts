type RecipientInput = string | string[] | undefined

export type GasEmailRequest = {
  to: RecipientInput
  cc?: RecipientInput
  bcc?: RecipientInput
  senderName?: string
  subject?: string
  htmlBody: string
  replyTo?: string
}

export type GasEmailResponse = {
  ok: boolean
  message?: string
  error?: string
}

const DEFAULT_SUBJECT = '(no subject)'

const normalizeRecipients = (value: RecipientInput): string[] => {
  if (!value) return []

  const list = Array.isArray(value) ? value : value.split(/,|\n/)

  return list
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0)
}

export const sendGasTestEmail = async (payload: GasEmailRequest): Promise<GasEmailResponse> => {
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
    // レスポンスがJSONでない場合はnullのまま扱う
  }

  if (!response.ok || !result?.ok) {
    const errorMessage = result?.error || `メール送信に失敗しました (status: ${response.status})`
    throw new Error(errorMessage)
  }

  return result
}
