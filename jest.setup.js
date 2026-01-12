import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { ReadableStream } from 'stream/web'

// グローバル環境にTextEncoder/TextDecoderを追加
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.ReadableStream = ReadableStream

const { Request, Response, Headers } = require('next/dist/compiled/@edge-runtime/primitives/fetch')
global.Request = Request
global.Response = Response
global.Headers = Headers

// Mock環境変数
process.env.CHILD_ID_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.GOOGLE_GENAI_API_KEY = 'test-gemini-api-key'
