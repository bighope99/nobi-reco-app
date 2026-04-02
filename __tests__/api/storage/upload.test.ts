import { NextRequest } from 'next/server'
import { POST } from '@/app/api/storage/upload/route'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt'

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}))

describe('POST /api/storage/upload', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>
  const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>

  beforeEach(() => {
    jest.resetAllMocks()
    mockGetAuthenticatedUserMetadata.mockResolvedValue({
      user_id: 'user-1',
      role: 'staff',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    })
  })

  it('uploadToSignedUrl に token を渡す（signedUrl ではなく）', async () => {
    const uploadToSignedUrl = jest.fn().mockResolvedValue({ error: null })
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-access-url' },
      error: null,
    })

    const supabaseMock = {
      storage: {
        from: jest.fn().mockReturnValue({
          createSignedUploadUrl: jest.fn().mockResolvedValue({
            data: {
              path: 'facility-1/2026-03-19/test-uuid.jpg',
              signedUrl: 'https://example.com/signed-upload-url',
              token: 'test-upload-token',
            },
            error: null,
          }),
          uploadToSignedUrl,
          createSignedUrl,
        }),
      },
    }

    mockedCreateClient.mockResolvedValue(supabaseMock as any)

    const file = Object.assign(
      new File(['dummy'], 'test.jpg', { type: 'image/jpeg' }),
      { arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)) }
    )
    const formData = {
      get: jest.fn((key: string) => {
        if (key === 'file') return file
        if (key === 'activity_date') return '2026-03-19'
        if (key === 'caption') return null
        return null
      }),
    }

    const request = {
      formData: jest.fn().mockResolvedValue(formData),
    } as unknown as NextRequest

    await POST(request)

    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      'test-upload-token',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/jpeg' })
    )
  }, 10000)
})
