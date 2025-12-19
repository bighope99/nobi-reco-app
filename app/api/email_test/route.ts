import { NextRequest, NextResponse } from 'next/server'
import { sendGasTestEmail, type GasEmailRequest } from '@/lib/email/gas-mailer'

const BAD_REQUEST_MESSAGE = 'to と htmlBody は必須です'

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
