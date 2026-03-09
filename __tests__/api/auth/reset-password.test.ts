import { NextRequest } from 'next/server';
import { POST } from '@/app/api/auth/reset-password/route';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { sendWithGas } from '@/lib/email/gas';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

jest.mock('@/lib/email/gas', () => ({
  sendWithGas: jest.fn(),
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/auth/reset-password', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
  const mockedSendWithGas = sendWithGas as jest.MockedFunction<typeof sendWithGas>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return 400 when email is missing', async () => {
    const response = await POST(buildRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('メールアドレスを入力してください');
  });

  it('should return 400 when email format is invalid', async () => {
    const response = await POST(buildRequest({ email: 'not-an-email' }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('メールアドレスの形式が正しくありません');
  });

  it('should return success even if user does not exist (prevent email enumeration)', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const mockSupabase = { from: jest.fn().mockReturnValue({ select: mockSelect }) };
    mockedCreateClient.mockResolvedValue(mockSupabase as never);

    const response = await POST(buildRequest({ email: 'nonexistent@example.com' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    // sendWithGas should NOT be called for non-existent users
    expect(mockedSendWithGas).not.toHaveBeenCalled();
  });

  it('should send reset email for existing user', async () => {
    const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockUser }),
        }),
      }),
    });
    const mockSupabase = { from: jest.fn().mockReturnValue({ select: mockSelect }) };
    mockedCreateClient.mockResolvedValue(mockSupabase as never);

    const mockAdminClient = {
      auth: {
        admin: {
          generateLink: jest.fn().mockResolvedValue({
            data: {
              properties: {
                action_link: 'https://supabase.example.com/auth/v1/verify?token_hash=abc123&type=recovery',
              },
            },
            error: null,
          }),
        },
      },
    };
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as never);
    mockedSendWithGas.mockResolvedValue({ ok: true });

    const response = await POST(buildRequest({ email: 'test@example.com' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify generateLink was called with recovery type
    expect(mockAdminClient.auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'test@example.com',
    });

    // Verify email was sent
    expect(mockedSendWithGas).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: '【のびレコ】パスワード再設定のご案内',
      })
    );

    // Verify the reset URL points to /password/setup with recovery type
    const sendCall = mockedSendWithGas.mock.calls[0][0];
    expect(sendCall.htmlBody).toContain('/password/setup?token_hash=abc123&type=recovery');
  });

  it('should return 500 when link generation fails', async () => {
    const mockUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' };
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockUser }),
        }),
      }),
    });
    const mockSupabase = { from: jest.fn().mockReturnValue({ select: mockSelect }) };
    mockedCreateClient.mockResolvedValue(mockSupabase as never);

    const mockAdminClient = {
      auth: {
        admin: {
          generateLink: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Link generation failed'),
          }),
        },
      },
    };
    mockedCreateAdminClient.mockResolvedValue(mockAdminClient as never);

    const response = await POST(buildRequest({ email: 'test@example.com' }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('リセットメールの送信に失敗しました');
  });
});
