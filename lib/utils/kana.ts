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

/** カタカナ → ひらがな変換 */
export function toHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  )
}

/** カナ先頭文字（カタカナ）から50音行（ひらがな）を返す */
const KANA_ROW_MAP: Record<string, string[]> = {
  'あ': ['ア','イ','ウ','エ','オ'],
  'か': ['カ','キ','ク','ケ','コ','ガ','ギ','グ','ゲ','ゴ'],
  'さ': ['サ','シ','ス','セ','ソ','ザ','ジ','ズ','ゼ','ゾ'],
  'た': ['タ','チ','ツ','テ','ト','ダ','ヂ','ヅ','デ','ド'],
  'な': ['ナ','ニ','ヌ','ネ','ノ'],
  'は': ['ハ','ヒ','フ','ヘ','ホ','バ','ビ','ブ','ベ','ボ','パ','ピ','プ','ペ','ポ'],
  'ま': ['マ','ミ','ム','メ','モ'],
  'や': ['ヤ','ユ','ヨ'],
  'ら': ['ラ','リ','ル','レ','ロ'],
  'わ': ['ワ','ヲ','ン'],
}

export function getKanaRow(katakanaChar: string): string | null {
  for (const [row, chars] of Object.entries(KANA_ROW_MAP)) {
    if (chars.includes(katakanaChar)) return row
  }
  return null
}
