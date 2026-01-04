/** @jest-environment node */
/**
 * 観察記録保存APIのテスト
 * POST /api/records/personal
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

// モック
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/session');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetUserSession = getUserSession as jest.MockedFunction<typeof getUserSession>;

describe('POST /api/records/personal', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Supabaseクライアントのモック
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
  });

  describe('正常系', () => {
    it('観察記録とAI解析結果（タグ）を正しく保存できる', async () => {
      // 認証情報のモック
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockGetUserSession.mockResolvedValue({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-123',
        company_name: 'Test Company',
        current_facility_id: 'facility-123',
        facilities: [],
        classes: [],
      });

      // 子ども情報のモック
      const mockChildQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // 観察記録挿入のモック
      const mockObservationInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'observation-123' },
          error: null,
        }),
      };

      // タグ挿入のモック
      const mockTagInsert = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        if (table === 'r_observation') return mockObservationInsert;
        if (table === '_record_tag') return mockTagInsert;
        return {};
      });

      // リクエストの作成
      const requestBody = {
        child_id: 'child-123',
        observation_date: '2024-01-15',
        content: 'テスト観察内容',
        ai_action: '客観的事実',
        ai_opinion: '主観的解釈',
        tag_flags: {
          'tag-001': true,
          'tag-002': false,
          'tag-003': true,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      // APIの実行
      const response = await POST(request);
      const data = await response.json();

      // アサーション
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('observation-123');
      expect(data.data.child_id).toBe('child-123');
      expect(data.data.observation_date).toBe('2024-01-15');
      expect(data.data.content).toBe('テスト観察内容');
      expect(mockObservationInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          child_id: 'child-123',
          observation_date: '2024-01-15',
          content: 'テスト観察内容',
          objective: '客観的事実',
          subjective: '主観的解釈',
          is_ai_analyzed: true,
          ai_analyzed_at: expect.any(String),
        }),
      );

      // タグが正しく保存されたか確認
      expect(mockTagInsert.insert).toHaveBeenCalledWith([
        {
          observation_id: 'observation-123',
          tag_id: 'tag-001',
          is_auto_tagged: true,
          confidence_score: null,
        },
        {
          observation_id: 'observation-123',
          tag_id: 'tag-003',
          is_auto_tagged: true,
          confidence_score: null,
        },
      ]);
    });

    it('タグがない場合でも観察記録を保存できる', async () => {
      // 認証情報のモック
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockGetUserSession.mockResolvedValue({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-123',
        company_name: 'Test Company',
        current_facility_id: 'facility-123',
        facilities: [],
        classes: [],
      });

      // 子ども情報のモック
      const mockChildQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // 観察記録挿入のモック
      const mockObservationInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'observation-456' },
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        if (table === 'r_observation') return mockObservationInsert;
        return {};
      });

      // リクエストの作成（タグなし）
      const requestBody = {
        child_id: 'child-123',
        observation_date: '2024-01-16',
        content: 'タグなしテスト',
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      // APIの実行
      const response = await POST(request);
      const data = await response.json();

      // アサーション
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('observation-456');
      expect(mockObservationInsert.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          child_id: 'child-123',
          observation_date: '2024-01-16',
          content: 'タグなしテスト',
          objective: null,
          subjective: null,
          is_ai_analyzed: false,
          ai_analyzed_at: null,
        }),
      );
    });
  });

  describe('異常系', () => {
    it('未認証の場合は401を返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unauthorized'),
      });

      const requestBody = {
        child_id: 'child-123',
        observation_date: '2024-01-15',
        content: 'テスト',
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('必須項目が不足している場合は400を返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockGetUserSession.mockResolvedValue({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-123',
        company_name: 'Test Company',
        current_facility_id: 'facility-123',
        facilities: [],
        classes: [],
      });

      // child_idが欠けているリクエスト
      const requestBody = {
        observation_date: '2024-01-15',
        content: 'テスト',
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('必須項目');
    });

    it('他の施設の子どもの記録を作成しようとした場合は403を返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      mockGetUserSession.mockResolvedValue({
        user_id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'staff',
        company_id: 'company-123',
        company_name: 'Test Company',
        current_facility_id: 'facility-123',
        facilities: [],
        classes: [],
      });

      // 別の施設の子ども
      const mockChildQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-999' }, // 異なる施設ID
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        return {};
      });

      const requestBody = {
        child_id: 'child-123',
        observation_date: '2024-01-15',
        content: 'テスト',
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('権限');
    });
  });
});
