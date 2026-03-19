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
 * 検索用正規化: ひらがな→カタカナ, 全角・半角スペース除去, 小文字化
 * スペースの有無に関わらずマッチさせるため、全空白を除去する
 * 例: "山田花子" と "山田 花子" が相互にマッチする
 */
export function normalizeSearch(text: string): string {
  return toKatakana(text.replace(/[\s　]/g, '').toLowerCase())
}
