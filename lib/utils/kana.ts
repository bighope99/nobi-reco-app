/** ひらがな → カタカナ変換 */
export function toKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) + 0x60)
  )
}

/**
 * カタカナに正規化（ひらがな→カタカナ、小文字化、空白除去）
 * 検索の表記ゆれ対策に使用
 */
export function normalizeKana(text: string): string {
  return toKatakana(text.toLowerCase().replace(/\s/g, ''))
}

/**
 * 検索用正規化: ひらがな→カタカナ, 全角スペース→半角スペース, 小文字化
 * スペースは除去せず保持するため、単語区切りを維持した検索に適している
 */
export function normalizeSearch(text: string): string {
  return toKatakana(text.replace(/　/g, ' ').toLowerCase())
}
