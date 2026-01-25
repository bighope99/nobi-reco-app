/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Vercel環境でフォントファイルを含めるための設定
  outputFileTracingIncludes: {
    '/api/children/qr': ['./lib/qr/fonts/**/*'],
    '/api/children/[id]/qr': ['./lib/qr/fonts/**/*'],
  },
}

export default nextConfig