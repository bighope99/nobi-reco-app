import { NextRequest, NextResponse } from "next/server"

import { sendWithGas } from "@/lib/email/gas"
import { BAD_REQUEST_MESSAGE, EmailRequestBody } from "@/lib/email/types"

export async function POST(request: NextRequest) {
  try {
    const body = ((await request.json().catch(() => null)) || {}) as EmailRequestBody
    const result = await sendWithGas(body)

    return NextResponse.json({
      ok: result.ok,
      message: result.message ?? "sent",
    })
  } catch (error) {
    console.error("メール送信テストエラー", error)
    const message = error instanceof Error ? error.message : "メール送信に失敗しました"
    const status = message === BAD_REQUEST_MESSAGE ? 400 : 500

    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
