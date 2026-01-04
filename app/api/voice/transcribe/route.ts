import { NextResponse } from "next/server"
import { getVoiceTranscriptionPrompt } from "@/lib/ai/prompts"

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GeminiのAPIキーが設定されていません" },
        { status: 500 },
      )
    }

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

    // Gemini APIを直接呼び出し（LangChainJSは音声ファイルを直接サポートしていないため）
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`

    const payload = {
      contents: [
        {
          parts: [
            {
              text: getVoiceTranscriptionPrompt(),
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
      },
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.message ||
          `Gemini APIエラー: ${response.status} ${response.statusText}`,
      )
    }

    const data = await response.json()

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      !data.candidates[0].content.parts[0] ||
      !data.candidates[0].content.parts[0].text
    ) {
      throw new Error("Geminiから文字起こし結果を取得できませんでした")
    }

    const transcript = data.candidates[0].content.parts[0].text.trim()

    if (!transcript) {
      throw new Error("文字起こし結果が空でした")
    }

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
