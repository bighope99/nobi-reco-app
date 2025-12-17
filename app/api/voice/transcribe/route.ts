import { NextResponse } from "next/server"
import { RunnableLambda } from "@langchain/core/runnables"

const buildTranscriptionPayload = ({
  audioBase64,
  mimeType,
}: {
  audioBase64: string
  mimeType: string
}) => ({
  contents: [
    {
      role: "user",
      parts: [
        {
          text:
            "次の音声メモを日本語で文字起こししてください。児童や保護者など個人を特定する名前は一般的な仮名（例: 児童A、児童B）に置き換えてください。",
        },
        {
          inlineData: {
            data: audioBase64,
            mimeType,
          },
        },
      ],
    },
  ],
})

const geminiTranscriptionChain = new RunnableLambda<
  { audioBase64: string; mimeType: string },
  string
>(async ({ audioBase64, mimeType }) => {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error("GeminiのAPIキーが設定されていません")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildTranscriptionPayload({ audioBase64, mimeType })),
      next: { revalidate: 0 },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

  if (!transcript) {
    throw new Error("Geminiから文字起こし結果を取得できませんでした")
  }

  return transcript
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio")

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "音声ファイルが送信されていません" },
        { status: 400 },
      )
    }

    const mimeType = audioFile.type || "audio/webm"
    const buffer = Buffer.from(await audioFile.arrayBuffer())
    const audioBase64 = buffer.toString("base64")

    const transcript = await geminiTranscriptionChain.invoke({
      audioBase64,
      mimeType,
    })

    return NextResponse.json({ success: true, text: transcript })
  } catch (error) {
    console.error("Failed to transcribe voice memo", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "文字起こし中にエラーが発生しました",
      },
      { status: 500 },
    )
  }
}
