import QRCode from 'qrcode'
import { createHmac } from 'crypto'
import { deflateRawSync } from 'zlib'
import { getQrSignatureSecret } from '@/lib/qr/secrets'

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

const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89 // A4 height in points

const ESCAPE_REGEX = /[\\()]/g
const PDF_HEADER = '%PDF-1.4\n'

function escapePdfText(text: string): string {
  return text.replace(ESCAPE_REGEX, (match) => `\\${match}`)
}

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

function buildQrDrawing(payload: string) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const moduleCount = qr.modules.size
  const qrDisplaySize = Math.min(PAGE_WIDTH, PAGE_HEIGHT) - 200
  const moduleSize = Math.max(2, Math.floor(qrDisplaySize / moduleCount))
  const qrSize = moduleSize * moduleCount
  const startX = (PAGE_WIDTH - qrSize) / 2
  const startY = (PAGE_HEIGHT - qrSize) / 2 - 30

  const commands: string[] = []
  commands.push('q')
  commands.push('0 0 0 rg')

  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      const filled = qr.modules.get(x, y)
      if (!filled) continue

      const rectX = startX + x * moduleSize
      const rectY = startY + (moduleCount - y - 1) * moduleSize
      commands.push(`${rectX.toFixed(2)} ${rectY.toFixed(2)} ${moduleSize} ${moduleSize} re f`)
    }
  }

  commands.push('Q')
  return commands.join('\n')
}

function buildContentStream(options: PdfOptions): Buffer {
  const { childName, facilityName, payload } = options
  const lines: string[] = []

  lines.push('BT')
  lines.push('/F1 20 Tf')
  lines.push(`1 0 0 1 64 ${PAGE_HEIGHT - 80} Tm (${escapePdfText(childName)}) Tj`)

  lines.push('/F1 14 Tf')
  lines.push(`1 0 0 1 64 ${PAGE_HEIGHT - 105} Tm (${escapePdfText(facilityName)}) Tj`)
  lines.push('ET')

  lines.push(buildQrDrawing(payload))

  const content = lines.join('\n')
  return Buffer.from(content, 'utf8')
}

export function createQrPdf(options: PdfOptions): Buffer {
  const contentStream = buildContentStream(options)
  const contentLength = contentStream.length

  let offset = 0
  const offsets: number[] = []
  const parts: Buffer[] = []

  const append = (buf: Buffer) => {
    parts.push(buf)
    offset += buf.length
  }

  const addObject = (id: number, body: string | Buffer) => {
    offsets[id] = offset
    const header = Buffer.from(`${id} 0 obj\n`, 'utf8')
    const footer = Buffer.from('\nendobj\n', 'utf8')
    append(header)
    append(Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'))
    append(footer)
  }

  append(Buffer.from(PDF_HEADER, 'utf8'))
  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>')
  addObject(2, '<< /Type /Pages /Count 1 /Kids [3 0 R] >>')
  addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`
  )
  addObject(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  addObject(5, `<< /Length ${contentLength} >>\nstream\n${contentStream.toString('utf8')}\nendstream`)

  const xrefOffset = offset
  let xref = 'xref\n0 6\n'
  xref += '0000000000 65535 f \n'
  for (let i = 1; i <= 5; i += 1) {
    const refOffset = offsets[i] ?? 0
    xref += `${refOffset.toString().padStart(10, '0')} 00000 n \n`
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  append(Buffer.from(xref, 'utf8'))
  append(Buffer.from(trailer, 'utf8'))

  return Buffer.concat(parts)
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
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'qr'
}

