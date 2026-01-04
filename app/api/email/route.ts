import { NextRequest, NextResponse } from "next/server"

import { isBadRequestError, sendWithResend } from "@/lib/email/resend"
import { BAD_REQUEST_MESSAGE, EmailRequestBody } from "@/lib/email/types"
import { createClient } from "@/utils/supabase/server"

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

    const body = ((await request.json().catch(() => null)) || {}) as EmailRequestBody

    const result = await sendWithResend(body)

    return NextResponse.json({
      success: true,
      ok: true,
      data: { id: result.id ?? null },
      message: result.message ?? "sent",
    })
  } catch (error) {
    console.error("メール送信エラー", error)
    const message = error instanceof Error ? error.message : "内部エラーが発生しました。"

    const status = isBadRequestError(error) || message === BAD_REQUEST_MESSAGE ? 400 : 500

    return NextResponse.json({ success: false, ok: false, error: message }, { status })
  }
}
