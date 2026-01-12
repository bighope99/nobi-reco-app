require('@testing-library/jest-dom')
const { TextEncoder, TextDecoder } = require('util')
const { ReadableStream } = require('stream/web')

// グローバル環境にTextEncoder/TextDecoderを追加
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.ReadableStream = ReadableStream

const { Request, Response, Headers, fetch } = require('next/dist/compiled/@edge-runtime/primitives/fetch')
global.Request = Request
global.Response = Response
global.Headers = Headers
global.fetch = fetch

// Mock環境変数
process.env.CHILD_ID_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.GOOGLE_GENAI_API_KEY = 'test-gemini-api-key'
process.env.PII_ENCRYPTION_KEY = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
