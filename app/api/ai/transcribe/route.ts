import { NextRequest, NextResponse } from 'next/server';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini APIキーが設定されていません' },
        { status: 500 }
      );
    }

    const { audio, mimeType } = await request.json();

    if (!audio) {
      return NextResponse.json(
        { success: false, error: '音声データが見つかりませんでした' },
        { status: 400 }
      );
    }

    const prompt =
      'あなたは保育記録の補助AIです。与えられた音声の内容を日本語で簡潔に文字起こしし、箇条書きではなく自然な文章に整えてください。保育現場の文体を保ち、不要な個人情報や識別子は含めないでください。';

    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: mimeType || 'audio/webm',
                data: audio,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 256,
      },
    };

    const geminiResponse = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini transcription error:', errorText);
      return NextResponse.json(
        { success: false, error: '音声の解析に失敗しました' },
        { status: 502 }
      );
    }

    const data = await geminiResponse.json();
    const textParts = data?.candidates?.[0]?.content?.parts || [];
    const transcript = textParts
      .map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: '文字起こしのテキストが取得できませんでした' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, text: transcript });
  } catch (error) {
    console.error('Transcription route error:', error);
    return NextResponse.json(
      { success: false, error: '音声の処理に失敗しました' },
      { status: 500 }
    );
  }
}
