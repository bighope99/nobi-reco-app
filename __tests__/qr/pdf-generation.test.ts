import {
  createQrPdf,
  createQrPayload,
  formatFileSegment,
  createContentDisposition,
  formatGradePrefix,
} from '@/lib/qr/card-generator'

// Mock the QR signature secret
jest.mock('@/lib/qr/secrets', () => ({
  getQrSignatureSecret: () => 'test-secret-key',
}))

describe('QR PDF Generation', () => {
  describe('createQrPayload', () => {
    it('ペイロードと署名を生成する', () => {
      const result = createQrPayload('child-123', 'facility-456')

      expect(result).toHaveProperty('payload')
      expect(result).toHaveProperty('signature')
      expect(typeof result.payload).toBe('string')
      expect(typeof result.signature).toBe('string')
    })

    it('ペイロードにchild_idとfacility_idが含まれる', () => {
      const result = createQrPayload('child-123', 'facility-456')
      const parsed = JSON.parse(result.payload)

      expect(parsed.child_id).toBe('child-123')
      expect(parsed.facility_id).toBe('facility-456')
      expect(parsed.type).toBe('attendance')
    })
  })

  describe('createQrPdf', () => {
    it('PDFを生成できる', async () => {
      const { payload } = createQrPayload('child-123', 'facility-456')

      const pdfBuffer = await createQrPdf({
        childName: '山田 太郎',
        facilityName: 'テスト保育園',
        payload,
      })

      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
      // PDFヘッダーの確認
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-')
    })

    it('空の名前でもPDFを生成できる', async () => {
      const { payload } = createQrPayload('child-123', 'facility-456')

      const pdfBuffer = await createQrPdf({
        childName: '',
        facilityName: '',
        payload,
      })

      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
    })

    it('非常に長い名前でもPDFを生成できる', async () => {
      const { payload } = createQrPayload('child-123', 'facility-456')
      const longName = '山田'.repeat(50) // 100文字の名前

      const pdfBuffer = await createQrPdf({
        childName: longName,
        facilityName: 'とても長い施設名のテスト保育園学童クラブ児童館',
        payload,
      })

      expect(pdfBuffer).toBeInstanceOf(Buffer)
      expect(pdfBuffer.length).toBeGreaterThan(0)
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-')
    })
  })

  describe('formatFileSegment', () => {
    it('日本語を保持する', () => {
      expect(formatFileSegment('山田太郎')).toBe('山田太郎')
    })

    it('スペースを除去する', () => {
      expect(formatFileSegment('山田 太郎')).toBe('山田太郎')
    })

    it('ファイル名に使えない文字を除去する', () => {
      expect(formatFileSegment('test/file:name')).toBe('testfilename')
    })

    it('空文字列の場合はqrを返す', () => {
      expect(formatFileSegment('')).toBe('qr')
    })
  })

  describe('createContentDisposition', () => {
    it('日本語ファイル名をUTF-8エンコードする', () => {
      const header = createContentDisposition('山田太郎.pdf')
      // filename*がUTF-8エンコードされていることを確認
      expect(header).toContain("filename*=UTF-8''")
      expect(header).toContain('%E5%B1%B1%E7%94%B0%E5%A4%AA%E9%83%8E.pdf')
    })

    it('ASCII文字のみのファイル名も正しく処理する', () => {
      const header = createContentDisposition('test.pdf')
      expect(header).toContain('filename="test.pdf"')
    })

    it('日本語ファイル名の場合、filename*が優先される形式になる', () => {
      const header = createContentDisposition('山田太郎_abc123.pdf')
      // RFC 5987/6266: filename*=UTF-8'' が含まれる
      expect(header).toMatch(/filename\*=UTF-8''/)
    })
  })

  describe('formatGradePrefix', () => {
    it('1年生の場合は"1"を返す', () => {
      expect(formatGradePrefix(1)).toBe('1')
    })

    it('6年生の場合は"6"を返す', () => {
      expect(formatGradePrefix(6)).toBe('6')
    })

    it('7年生以上の場合は"10"を返す', () => {
      expect(formatGradePrefix(7)).toBe('10')
      expect(formatGradePrefix(10)).toBe('10')
    })

    it('0年生以下の場合は"0"を返す', () => {
      expect(formatGradePrefix(0)).toBe('0')
      expect(formatGradePrefix(-1)).toBe('0')
    })

    it('nullの場合は"0"を返す', () => {
      expect(formatGradePrefix(null)).toBe('0')
    })
  })
})
