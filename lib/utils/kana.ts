/**
 * ひらがな → カタカナ変換
 */
export function toKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) + 0x60)
  )
}

/**
 * カタカナに正規化（ひらがな→カタカナ、小文字化、空白除去）
 * クラス名・担任名などの表記ゆれ対策に使用
 */
export function normalizeKana(text: string): string {
  return toKatakana(text.toLowerCase().replace(/\s/g, ""))
}
