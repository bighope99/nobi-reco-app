/** @jest-environment node */
/**
 * 観察記録保存時にactivity_idを受け取る機能のテスト
 * POST /api/records/personal
 */

import { POST } from '@/app/api/records/personal/route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

// モック
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/jwt');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

const BASE_METADATA = {
  user_id: 'user-123',
  role: 'staff' as const,
  company_id: 'company-123',
  current_facility_id: 'facility-123',
};

describe('POST /api/records/personal - activity_id機能', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Supabaseクライアントのモック
    mockSupabase = {
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetAuthenticatedUserMetadata.mockResolvedValue(BASE_METADATA);
  });

  describe('activity_idの保存', () => {
    it('activity_idが指定された場合、r_observationに保存すること', async () => {
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

      // アクティビティ検証のモック
      const mockActivityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // 観察記録挿入のモック（挿入されたデータをキャプチャ）
      let insertedData: any = null;
      const mockObservationInsert = {
        insert: jest.fn((data) => {
          insertedData = data;
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'observation-123', ...data },
              error: null,
            }),
          };
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
        if (table === 'r_activity') return mockActivityQuery;
        if (table === 'r_observation') return mockObservationInsert;
        if (table === '_record_tag') return mockTagInsert;
        if (table === 'm_users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'recorder-123' }, error: null }) };
        return {};
      });

      // リクエストの作成（activity_idを含む）
      const requestBody = {
        child_id: 'child-123',
        observation_date: '2026-01-09',
        content: 'テスト観察内容',
        activity_id: 'activity-456', // ← activity_idを指定
        recorded_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ai_action: '客観的事実',
        ai_opinion: '主観的解釈',
        tag_flags: {
          'tag-001': true,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      // レスポンスの確認
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // insertedDataにactivity_idが含まれていることを確認
      expect(insertedData).toBeDefined();
      expect(insertedData.activity_id).toBe('activity-456');
    });

    it('activity_idがnullの場合、r_observationにnullで保存すること', async () => {
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

      // アクティビティ検証のモック（activity_id=nullなので呼ばれないが、念のため）
      const mockActivityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // 観察記録挿入のモック
      let insertedData: any = null;
      const mockObservationInsert = {
        insert: jest.fn((data) => {
          insertedData = data;
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'observation-123', ...data },
              error: null,
            }),
          };
        }),
      };

      const mockTagInsert = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        if (table === 'r_activity') return mockActivityQuery;
        if (table === 'r_observation') return mockObservationInsert;
        if (table === '_record_tag') return mockTagInsert;
        if (table === 'm_users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'recorder-123' }, error: null }) };
        return {};
      });

      // リクエストの作成（activity_id = null）
      const requestBody = {
        child_id: 'child-123',
        observation_date: '2026-01-09',
        content: 'テスト観察内容',
        activity_id: null, // ← nullを明示的に指定
        recorded_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ai_action: '客観的事実',
        ai_opinion: '主観的解釈',
        tag_flags: {},
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // insertedDataのactivity_idがnullであることを確認
      expect(insertedData).toBeDefined();
      expect(insertedData.activity_id).toBeNull();
    });

    it('activity_idが未指定の場合、nullとして保存すること（後方互換性）', async () => {
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

      // アクティビティ検証のモック（activity_id未指定なので呼ばれないが、念のため）
      const mockActivityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // 観察記録挿入のモック
      let insertedData: any = null;
      const mockObservationInsert = {
        insert: jest.fn((data) => {
          insertedData = data;
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'observation-123', ...data },
              error: null,
            }),
          };
        }),
      };

      const mockTagInsert = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        if (table === 'r_activity') return mockActivityQuery;
        if (table === 'r_observation') return mockObservationInsert;
        if (table === '_record_tag') return mockTagInsert;
        if (table === 'm_users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'recorder-123' }, error: null }) };
        return {};
      });

      // リクエストの作成（activity_idを含まない）
      const requestBody = {
        child_id: 'child-123',
        observation_date: '2026-01-09',
        content: 'テスト観察内容',
        // activity_id: 指定しない
        recorded_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ai_action: '客観的事実',
        ai_opinion: '主観的解釈',
        tag_flags: {},
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // insertedDataのactivity_idがnullであることを確認（デフォルト値）
      expect(insertedData).toBeDefined();
      expect(insertedData.activity_id).toBeNull();
    });
  });

  describe('activity_idの検証', () => {
    it('activity_idが文字列の場合、そのまま保存すること', async () => {
      const mockChildQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // アクティビティ検証のモック
      const mockActivityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      let insertedData: any = null;
      const mockObservationInsert = {
        insert: jest.fn((data) => {
          insertedData = data;
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'observation-123', ...data },
              error: null,
            }),
          };
        }),
      };

      const mockTagInsert = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        if (table === 'r_activity') return mockActivityQuery;
        if (table === 'r_observation') return mockObservationInsert;
        if (table === '_record_tag') return mockTagInsert;
        if (table === 'm_users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'recorder-123' }, error: null }) };
        return {};
      });

      const requestBody = {
        child_id: 'child-123',
        observation_date: '2026-01-09',
        content: 'テスト観察内容',
        activity_id: 'valid-uuid-string',
        recorded_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ai_action: '',
        ai_opinion: '',
        tag_flags: {},
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      await POST(request);

      expect(insertedData.activity_id).toBe('valid-uuid-string');
    });

    it('activity_idが空文字列の場合、nullとして保存すること', async () => {
      const mockChildQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      // アクティビティ検証のモック（空文字列はnullに正規化されるので呼ばれないが、念のため）
      const mockActivityQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { facility_id: 'facility-123' },
          error: null,
        }),
      };

      let insertedData: any = null;
      const mockObservationInsert = {
        insert: jest.fn((data) => {
          insertedData = data;
          return {
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'observation-123', ...data },
              error: null,
            }),
          };
        }),
      };

      const mockTagInsert = {
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'm_children') return mockChildQuery;
        if (table === 'r_activity') return mockActivityQuery;
        if (table === 'r_observation') return mockObservationInsert;
        if (table === '_record_tag') return mockTagInsert;
        if (table === 'm_users') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'recorder-123' }, error: null }) };
        return {};
      });

      const requestBody = {
        child_id: 'child-123',
        observation_date: '2026-01-09',
        content: 'テスト観察内容',
        activity_id: '', // ← 空文字列
        recorded_by: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ai_action: '',
        ai_opinion: '',
        tag_flags: {},
      };

      const request = new NextRequest('http://localhost:3000/api/records/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      await POST(request);

      expect(insertedData.activity_id).toBeNull();
    });
  });
});
