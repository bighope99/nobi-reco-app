import QRCode from 'qrcode'
import { createHmac } from 'crypto'
import { deflateRawSync } from 'zlib'
import { getQrSignatureSecret } from '@/lib/qr/secrets'
import { PDFDocument, rgb } from 'pdf-lib'
import sharp from 'sharp'

interface QrPayload {
  payload: string
  signature: string
}

interface PdfOptions {
  childName: string
  facilityName: string
  payload: string
}

interface ZipEntry {
  filename: string
  content: Buffer
}

// A4 size in points (72 points per inch)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

export function createQrPayload(childId: string, facilityId: string): QrPayload {
  const secret = getQrSignatureSecret();
  const inputString = `${childId}${facilityId}${secret}`;
  const signature = createHmac('sha256', secret)
    .update(inputString)
    .digest('hex')

  const payload = JSON.stringify({
    type: 'attendance',
    child_id: childId,
    facility_id: facilityId,
    signature,
  })

  return { payload, signature }
}

export async function createQrPdf(options: PdfOptions): Promise<Buffer> {
  const { childName, facilityName, payload } = options

  // 入力検証
  const displayChildName = childName?.trim() || '(名前なし)'
  const displayFacilityName = facilityName?.trim() || '(施設名なし)'

  // Create PDF document
  const pdfDoc = await PDFDocument.create()

  // Add A4 page
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  // 日本語テキストをPNG画像として生成し埋め込み
  try {
    const textImageBuffer = await generateTextImage(displayChildName, displayFacilityName)
    const textImage = await pdfDoc.embedPng(textImageBuffer)

    // テキスト画像を描画（上部）
    page.drawImage(textImage, {
      x: 40,
      y: PAGE_HEIGHT - 100,
      width: 400,
      height: 80,
    })
  } catch (error) {
    // テキスト画像の生成に失敗した場合は無視（QRコードのみ表示）
    console.warn('Failed to generate text image:', error)
  }

  // Generate QR code as PNG buffer
  let qrPngBuffer: Uint8Array
  try {
    const buffer = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 1,
      width: 400,
    })
    // BufferをUint8Arrayに変換（pdf-lib互換性のため）
    qrPngBuffer = new Uint8Array(buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to generate QR code: ${message}`)
  }

  // Embed QR code image
  const qrImage = await pdfDoc.embedPng(qrPngBuffer)

  // Calculate QR code position (centered horizontally)
  const qrSize = 340 // points (approximately 120mm)
  const qrX = (PAGE_WIDTH - qrSize) / 2
  const qrY = (PAGE_HEIGHT - qrSize) / 2

  // Draw QR code
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  })

  // Save PDF
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

// 日本語テキストをPNG画像として生成
async function generateTextImage(childName: string, facilityName: string): Promise<Uint8Array> {
  // SVGを使用してテキストを画像化
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80">
<style>.child-name { font-family: sans-serif; font-size: 24px; fill: #000; } .facility-name { font-family: sans-serif; font-size: 16px; fill: #4a4a4a; }</style>
<text x="10" y="30" class="child-name">${escapeXml(childName)}</text>
<text x="10" y="60" class="facility-name">${escapeXml(facilityName)}</text>
</svg>`

  // SVGをPNGに変換（sharp使用）
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
  // BufferをUint8Arrayに変換（pdf-lib互換性のため）
  return new Uint8Array(pngBuffer)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toDosDateParts(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()

  const dosTime = (hours << 11) | (minutes << 5) | Math.floor(seconds / 2)
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosDate, dosTime }
}

function crc32(buffer: Buffer): number {
  let crc = ~0
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return ~crc >>> 0
}

export function createZip(entries: ZipEntry[]): Buffer {
  const fileRecords: Buffer[] = []
  const centralRecords: Buffer[] = []
  let offset = 0
  const now = new Date()
  const { dosDate, dosTime } = toDosDateParts(now)

  entries.forEach((entry) => {
    const nameBytes = Buffer.from(entry.filename, 'utf8')
    const crc = crc32(entry.content)
    const compressed = deflateRawSync(entry.content)

    const localHeader = Buffer.alloc(30 + nameBytes.length)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(entry.content.length, 22)
    localHeader.writeUInt16LE(nameBytes.length, 26)
    localHeader.writeUInt16LE(0, 28)
    nameBytes.copy(localHeader, 30)

    fileRecords.push(localHeader, compressed)

    const centralHeader = Buffer.alloc(46 + nameBytes.length)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(entry.content.length, 24)
    centralHeader.writeUInt16LE(nameBytes.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    nameBytes.copy(centralHeader, 46)

    centralRecords.push(centralHeader)

    offset += localHeader.length + compressed.length
  })

  const fileSection = Buffer.concat(fileRecords)
  const centralSection = Buffer.concat(centralRecords)

  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4)
  endRecord.writeUInt16LE(0, 6)
  endRecord.writeUInt16LE(entries.length, 8)
  endRecord.writeUInt16LE(entries.length, 10)
  endRecord.writeUInt32LE(centralSection.length, 12)
  endRecord.writeUInt32LE(fileSection.length, 16)
  endRecord.writeUInt16LE(0, 20)

  return Buffer.concat([fileSection, centralSection, endRecord])
}

export function formatFileSegment(value: string): string {
  // ファイル名として使えない文字とスペースを除去（日本語は保持）
  return value.replace(/[\\/:*?"<>|\s]+/g, '').trim() || 'qr'
}
