/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/records/activity/route';
import { decryptChildId } from '@/utils/crypto/childIdEncryption';
import { extractChildContent } from '@/lib/ai/contentExtractor';

// モック
jest.mock('@/lib/auth/session', () => ({
  getUserSession: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/ai/contentExtractor', () => ({
  extractChildContent: jest.fn(),
}));

jest.mock('@/utils/crypto/childIdEncryption', () => ({
  ...jest.requireActual('@/utils/crypto/childIdEncryption'),
  decryptChildId: jest.fn(),
}));

import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/activity', () => {
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

  const validChildId1 = '550e8400-e29b-41d4-a716-446655440001';
  const validChildId2 = '550e8400-e29b-41d4-a716-446655440002';

  const mockActivityData = {
    facility_id: 'test-facility-id',
    class_id: 'test-class-id',
    activity_date: '2025-01-02',
    title: 'テスト活動',
    content: '<mention data-child-id="token1">@田中太郎</mention>くんが積み木で高い塔を作りました。<mention data-child-id="token2">@佐藤花子</mention>さんも一緒に協力していました。',
    mentioned_children: ['token1', 'token2'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトでトークンを復号化できるように設定
    (decryptChildId as jest.Mock).mockImplementation((token: string) => {
      if (token === 'token1') return validChildId1;
      if (token === 'token2') return validChildId2;
      if (token === 'valid-token') return validChildId1;
      return null;
    });
  });

  describe('認証テスト', () => {
    it('認証されていない場合は401を返すこと', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
          }),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('活動記録保存', () => {
    it('活動記録を正しく保存できること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let insertedActivity: any = null;
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn((data) => {
                insertedActivity = data;
                return {
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'test-activity-id',
                      ...data,
                    },
                    error: null,
                  }),
                };
              }),
            };
          }
          if (tableName === 'r_observation') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-observation-id',
                    content: '抽出された内容',
                  },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(insertedActivity).toBeDefined();
      expect(insertedActivity.facility_id).toBe(mockSession.current_facility_id);
      expect(insertedActivity.created_by).toBe(mockSession.user_id);
      expect(insertedActivity.mentioned_children).toEqual(['token1', 'token2']);
    });

    it('保存された活動記録のIDを返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-activity-id',
                    ...mockActivityData,
                  },
                  error: null,
                }),
              })),
            };
          }
          if (tableName === 'r_observation') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-observation-id',
                  },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toBeDefined();
      expect(data.activity.id).toBe('test-activity-id');
    });
  });

  describe('個別記録自動生成', () => {
    it('メンションされた子供の個別記録を生成すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let observationInsertCount = 0;
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-activity-id',
                    ...mockActivityData,
                  },
                  error: null,
                }),
              })),
            };
          }
          if (tableName === 'r_observation') {
            return {
              insert: jest.fn(() => {
                observationInsertCount++;
                return {
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: `test-observation-id-${observationInsertCount}`,
                      content: '抽出された内容',
                    },
                    error: null,
                  }),
                };
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.observations).toBeDefined();
      expect(data.observations.length).toBe(2); // 2人の子供がメンション
    });

    it('AI内容抽出を各子供に対して実行すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-activity-id',
                    ...mockActivityData,
                  },
                  error: null,
                }),
              })),
            };
          }
          if (tableName === 'r_observation') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-observation-id',
                    content: '抽出された内容',
                  },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      await POST(request);

      // AI内容抽出が2回呼ばれること（2人の子供）
      expect(extractChildContent).toHaveBeenCalledTimes(2);
    });

    it('個別記録に元の活動記録IDを保存すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let observationData: any = null;
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-activity-id',
                    ...mockActivityData,
                  },
                  error: null,
                }),
              })),
            };
          }
          if (tableName === 'r_observation') {
            return {
              insert: jest.fn((data) => {
                observationData = data;
                return {
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'test-observation-id',
                      ...data,
                    },
                    error: null,
                  }),
                };
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      await POST(request);

      expect(observationData).toBeDefined();
      expect(observationData.activity_id).toBe('test-activity-id');
    });
  });

  describe('バリデーション', () => {
    it('必須フィールドが未指定の場合は400を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const invalidData = {
        // activity_date が欠けている
        content: 'テスト内容',
      };

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('contentが空文字の場合は400を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const invalidData = {
        activity_date: '2025-01-02',
        content: '',
        mentioned_children: [],
      };

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('content');
    });

    it('mentioned_childrenが配列でない場合は400を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const invalidData = {
        activity_date: '2025-01-02',
        content: 'テスト内容',
        mentioned_children: 'not-an-array',
      };

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('mentioned_children');
    });
  });

  describe('エラーハンドリング', () => {
    it('活動記録保存エラーの場合は500を返すこと', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        })),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('トークン復号化エラーの場合でも処理を継続すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      const dataWithInvalidToken = {
        ...mockActivityData,
        mentioned_children: ['valid-token', 'invalid-token'],
      };

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-activity-id',
                    ...dataWithInvalidToken,
                  },
                  error: null,
                }),
              })),
            };
          }
          if (tableName === 'r_observation') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-observation-id',
                    content: '抽出された内容',
                  },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(dataWithInvalidToken),
      });

      const response = await POST(request);
      const data = await response.json();

      // エラーがあっても200を返す（部分的な成功）
      expect(response.status).toBe(200);
      expect(data.activity).toBeDefined();
    });

    it('AI抽出エラーの場合でも処理を継続すること', async () => {
      (getUserSession as jest.Mock).mockResolvedValue(mockSession);
      (extractChildContent as jest.Mock).mockRejectedValue(new Error('AI error'));

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'test-activity-id',
                    ...mockActivityData,
                  },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify(mockActivityData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toBeDefined();
      // observations配列は存在するが、エラーにより空または一部のみ
    });
  });
});
