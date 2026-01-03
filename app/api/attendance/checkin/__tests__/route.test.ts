import { NextRequest } from 'next/server';
import { POST } from '../route';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import jwt from 'jsonwebtoken';

jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/session');
jest.mock('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

describe('/api/attendance/checkin POST', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: 'user-123',
              },
            },
          },
          error: null,
        }),
      },
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('認証チェック', () => {
    it('セッションがない場合は401を返す', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

                                                                                                                                                                it('current_facility_idがない場合は401を返す', async () => {
      (getUserSession as jest.Mock).mockResolvedValue({ user_id: 'user-123' });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('リクエストバリデーション', () => {
    beforeEach(() => {
      (getUserSession as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        current_facility_id: 'facility-123',
      });
    });

    it('tokenがない場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Token and child_id are required');
    });

    it('child_idがない場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Token and child_id are required');
    });
  });

  describe('JWT検証', () => {
    beforeEach(() => {
      (getUserSession as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        current_facility_id: 'facility-123',
      });
    });

    it('無効なトークンの場合は401を返す', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid or expired token');
    });

    it('施設IDが一致しない場合は403を返す', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        facility_id: 'different-facility',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Facility mismatch');
    });
  });

  describe('子ども存在チェック', () => {
    beforeEach(() => {
      (getUserSession as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        current_facility_id: 'facility-123',
      });

      (jwt.verify as jest.Mock).mockReturnValue({
        facility_id: 'facility-123',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    });

    it('子どもが見つからない場合は404を返す', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Child not found');
    });
  });

  describe('重複チェックイン検証', () => {
    beforeEach(() => {
      (getUserSession as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        current_facility_id: 'facility-123',
      });

      (jwt.verify as jest.Mock).mockReturnValue({
        facility_id: 'facility-123',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    });

    it('既にチェックイン済みの場合は409を返す', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'child-123',
            family_name: '田中',
            given_name: '太郎',
            _child_class: [
              {
                class: {
                  id: 'class-123',
                  name: 'ひまわり組',
                },
              },
            ],
          },
          error: null,
        });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          id: 'attendance-123',
          checked_in_at: new Date().toISOString(),
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Already checked in today');
      expect(data.data).toHaveProperty('child_id', 'child-123');
      expect(data.data).toHaveProperty('child_name', '田中 太郎');
      expect(data.data).toHaveProperty('class_name', 'ひまわり組');
    });
  });

  describe('チェックイン成功', () => {
    beforeEach(() => {
      (getUserSession as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        current_facility_id: 'facility-123',
      });

      (jwt.verify as jest.Mock).mockReturnValue({
        facility_id: 'facility-123',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    });

    it('正常にチェックインできる', async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'child-123',
            family_name: '田中',
            given_name: '太郎',
            _child_class: [
              {
                class: {
                  id: 'class-123',
                  name: 'ひまわり組',
                },
              },
            ],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'attendance-123',
            child_id: 'child-123',
            facility_id: 'facility-123',
            checked_in_at: now.toISOString(),
            check_in_method: 'qr',
            created_at: now.toISOString(),
          },
          error: null,
        });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('child_id', 'child-123');
      expect(data.data).toHaveProperty('child_name', '田中 太郎');
      expect(data.data).toHaveProperty('class_name', 'ひまわり組');
      expect(data.data).toHaveProperty('checked_in_at');
      expect(data.data).toHaveProperty('attendance_date', today);
    });

    it('チェックイン時にh_attendanceテーブルに正しいデータを挿入する', async () => {
      const now = new Date();

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'child-123',
            family_name: '田中',
            given_name: '太郎',
            _child_class: [
              {
                class: {
                  id: 'class-123',
                  name: 'ひまわり組',
                },
              },
            ],
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'attendance-123',
            child_id: 'child-123',
            facility_id: 'facility-123',
            checked_in_at: now.toISOString(),
            check_in_method: 'qr',
            created_at: now.toISOString(),
          },
          error: null,
        });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      await POST(request);

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          child_id: 'child-123',
          facility_id: 'facility-123',
          check_in_method: 'qr',
        })
      );
    });
  });

  describe('エラーハンドリング', () => {
    beforeEach(() => {
      (getUserSession as jest.Mock).mockResolvedValue({
        user_id: 'user-123',
        current_facility_id: 'facility-123',
      });

      (jwt.verify as jest.Mock).mockReturnValue({
        facility_id: 'facility-123',
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    });

    it('データベースエラー時は500を返す', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'child-123',
            family_name: '田中',
            given_name: '太郎',
            _child_class: [
              {
                class: {
                  id: 'class-123',
                  name: 'ひまわり組',
                },
              },
            ],
          },
          error: null,
        });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost:3000/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ token: 'test-token', child_id: 'child-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to record attendance');
    });
  });
});
