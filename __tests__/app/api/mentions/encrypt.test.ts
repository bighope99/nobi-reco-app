/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mentions/encrypt/route';
import { encryptChildId, decryptChildId } from '@/utils/crypto/childIdEncryption';

// モック
jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

describe('/api/mentions/encrypt', () => {
  const mockSession = {
    user_id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'teacher' as const,
    company_id: 'test-company-id',
    company_name: 'Test Company',
    facilities: [
      {
        facility_id: 'test-facility-id',
        facility_name: 'Test Facility',
        is_primary: true,
      },
    ],
    current_facility_id: 'test-facility-id',
    classes: [],
  };

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const validChildId = '550e8400-e29b-41d4-a716-446655440000';

  const createMockSupabase = (authUser: any, childData: any) => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: authUser },
        error: authUser ? null : new Error('Not authenticated'),
      }),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockResolvedValue(childData),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('認証テスト', () => {
    it('認証されていない場合は401を返すこと', async () => {
      const mockSupabase = createMockSupabase(null, null);
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('認証されている場合は暗号化トークンを返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, {
        data: [{ id: validChildId, facility_id: 'test-facility-id' }],
        error: null,
      });
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.encryptedToken).toBeDefined();
      expect(typeof data.encryptedToken).toBe('string');
      expect(data.encryptedToken.length).toBeGreaterThan(0);
    });
  });

  describe('暗号化トークン検証', () => {
    it('暗号化されたトークンが復号化可能であること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, {
        data: [{ id: validChildId, facility_id: 'test-facility-id' }],
        error: null,
      });
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      // 暗号化されたトークンを復号化
      const decrypted = decryptChildId(data.encryptedToken);
      expect(decrypted).toBe(validChildId);
    });

    it('URL-safe Base64形式であること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, {
        data: [{ id: validChildId, facility_id: 'test-facility-id' }],
        error: null,
      });
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      // URL-safeな文字のみ（英数字、ハイフン、アンダースコア）
      expect(data.encryptedToken).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('バリデーション', () => {
    it('childIdが未指定の場合は400を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, null);
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('childId');
    });

    it('childIdが空文字の場合は400を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, null);
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('childId');
    });

    it('UUIDでない場合は400を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, null);
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: 'invalid-uuid' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('UUID');
    });
  });

  describe('アクセス制御', () => {
    it('ユーザーの施設に属さない子供の暗号化を拒否すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, {
        data: [{ id: validChildId, facility_id: 'other-facility-id' }],
        error: null,
      });
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('存在しない子供IDの場合は404を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, {
        data: [],
        error: null,
      });
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Child not found');
    });
  });

  describe('エラーハンドリング', () => {
    it('データベースエラーの場合は500を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = createMockSupabase(mockUser, {
        data: null,
        error: { message: 'Database error' },
      });
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/mentions/encrypt', {
        method: 'POST',
        body: JSON.stringify({ childId: validChildId }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
