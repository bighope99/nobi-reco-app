import { toKatakana, normalizeKana } from '@/lib/utils/kana'

describe('toKatakana', () => {
  it('ひらがなをカタカナに変換する', () => {
    expect(toKatakana('きりん')).toBe('キリン')
    expect(toKatakana('あいうえお')).toBe('アイウエオ')
  })

  it('カタカナはそのまま返す', () => {
    expect(toKatakana('キリン')).toBe('キリン')
  })

  it('ひらがなとカタカナが混在する場合も変換する', () => {
    expect(toKatakana('きりンぐみ')).toBe('キリングミ')
  })

  it('漢字や英数字は変換しない', () => {
    expect(toKatakana('太陽グループ1')).toBe('太陽グループ1')
  })
})

describe('normalizeKana', () => {
  it('ひらがなとカタカナを同一視できる', () => {
    expect(normalizeKana('きりん')).toBe(normalizeKana('キリン'))
  })

  it('小文字化する', () => {
    expect(normalizeKana('ABC')).toBe(normalizeKana('abc'))
  })

  it('空白を除去する', () => {
    expect(normalizeKana('き り ん')).toBe(normalizeKana('きりん'))
  })
})
