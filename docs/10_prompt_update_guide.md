# AIプロンプト変更時の参照先

GeminiなどのAI解析プロンプトを変更する際は、以下のファイルを確認する。

## 1. 個別記録のAI解析（Gemini）
- `lib/ai/prompts.ts`: 解析プロンプト本体（`buildPersonalRecordPrompt`）
- `app/api/records/personal/ai/route.ts`: 解析の呼び出し経路
- `app/records/activity/page.tsx`: AI解析の呼び出しUI・結果反映
- `docs/04_api.md`: AI解析APIの仕様（`/ai/extract`）

> **注意**: AI解析は新規記録作成時のみ実行されます。編集時はAI再解析を行わず、事実・所感を直接編集する仕様です（`docs/api/10_activity_record_api.md` 参照）。

## 2. 活動記録から児童別抽出（Gemini）
- `lib/ai/prompts.ts`: 抽出用プロンプト（`buildActivityExtractionMessages`）
- `lib/ai/contentExtractor.ts`: 抽出の呼び出し経路
- `app/api/records/activity/route.ts`: 抽出処理の呼び出し経路（`extractChildContent`）

## 3. 音声メモ文字起こし（Gemini）
- `lib/ai/prompts.ts`: 文字起こしプロンプト（`getVoiceTranscriptionPrompt`）
- `app/api/voice/transcribe/route.ts`: 文字起こしの呼び出し経路

## 4. 依存する環境変数
- `.env.example`: `GOOGLE_GENAI_API_KEY` の定義
