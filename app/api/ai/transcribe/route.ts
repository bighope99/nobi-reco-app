import { NextRequest, NextResponse } from 'next/server'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

const transcriptionPrompt =
  'あなたは保育記録の補助AIです。与えられた音声の内容を日本語で簡潔に文字起こしし、箇条書きではなく自然な文章に整えてください。保育現場の文体を保ち、不要な個人情報や識別子は含めないでください。'

const inferAudioFormat = (mimeType?: string) => {
  if (!mimeType) return 'webm'

  const [, subtype] = mimeType.split('/')
  if (!subtype) return 'webm'

  return subtype.split(';')[0] || 'webm'
}

const extractTranscriptText = (content: unknown) => {
  if (typeof content === 'string') return content.trim()

  if (Array.isArray(content)) {
    const textParts = content
      .filter(
        (part): part is { type: string; text: string } =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          (part as { type: unknown }).type === 'text' &&
          typeof (part as { text: unknown }).text === 'string',
      )
      .map((part) => part.text.trim())
      .filter(Boolean)

    return textParts.join('\n')
  }

  return ''
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini APIキーが設定されていません' },
        { status: 500 },
      )
    }

    const { audio, mimeType } = await request.json()

    if (!audio) {
      return NextResponse.json(
        { success: false, error: '音声データが見つかりませんでした' },
        { status: 400 },
      )
    }

    const audioFormat = inferAudioFormat(mimeType)
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-flash',
      apiKey,
      temperature: 0.3,
      maxOutputTokens: 256,
    })

    const response = await model.invoke([
      {
        role: 'user',
        content: [
          { type: 'text', text: transcriptionPrompt },
          {
            type: 'input_audio',
            audio: {
              data: audio,
              format: audioFormat,
            },
          },
        ],
      },
    ])

    const transcript = extractTranscriptText(response.content)

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: '文字起こしのテキストが取得できませんでした' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, text: transcript })
  } catch (error) {
    console.error('Transcription route error:', error)
    return NextResponse.json(
      { success: false, error: '音声の処理に失敗しました' },
      { status: 500 },
    )
  }
}
