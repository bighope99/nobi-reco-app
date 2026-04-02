/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/records/activity/route';
import { decryptChildId } from '@/utils/crypto/childIdEncryption';
import { extractChildContent } from '@/lib/ai/contentExtractor';

// モック
jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
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

import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { createClient } from '@/utils/supabase/server';

describe('/api/records/activity', () => {
  const mockMetadata = {
    user_id: 'test-user-id',
    role: 'staff' as const,
    company_id: 'test-company-id',
    current_facility_id: 'test-facility-id',
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
    // デフォルトで認証済みメタデータを返す
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(mockMetadata);
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
      (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(null);

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

  describe('保育日誌保存', () => {
    it('保育日誌を正しく保存できること', async () => {
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let insertedActivity: any = null;
      const mockSupabase: Record<string, unknown> = {
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
      expect(insertedActivity.facility_id).toBe(mockMetadata.current_facility_id);
      expect(insertedActivity.created_by).toBe(mockMetadata.user_id);
      expect(insertedActivity.mentioned_children).toEqual(['token1', 'token2']);
    });

    it('保存された保育日誌のIDを返すこと', async () => {
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      const mockSupabase: Record<string, unknown> = {
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
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let observationInsertCount = 0;
      const mockSupabase: Record<string, unknown> = {
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
              insert: jest.fn((rows) => {
                observationInsertCount = Array.isArray(rows) ? rows.length : 1;
                const insertedData = Array.isArray(rows)
                  ? rows.map((row, i) => ({ id: `test-observation-id-${i + 1}`, content: '抽出された内容', ...row }))
                  : [{ id: 'test-observation-id-1', content: '抽出された内容', ...rows }];
                return {
                  select: jest.fn().mockResolvedValue({
                    data: insertedData,
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
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      const mockSupabase: Record<string, unknown> = {
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

    it('個別記録に元の保育日誌IDを保存すること', async () => {
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let observationData: any = null;
      const mockSupabase: Record<string, unknown> = {
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
                observationData = Array.isArray(data) ? data[0] : data;
                const insertedData = Array.isArray(data)
                  ? data.map((row, i) => ({ id: `test-observation-id-${i + 1}`, ...row }))
                  : [{ id: 'test-observation-id', ...data }];
                return {
                  select: jest.fn().mockResolvedValue({
                    data: insertedData,
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
      const mockSupabase: Record<string, unknown> = {
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
      const mockSupabase: Record<string, unknown> = {
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
      const mockSupabase: Record<string, unknown> = {
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
    it('保育日誌保存エラーの場合は500を返すこと', async () => {

      const mockSupabase: Record<string, unknown> = {
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
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      const dataWithInvalidToken = {
        ...mockActivityData,
        mentioned_children: ['valid-token', 'invalid-token'],
      };

      const mockSupabase: Record<string, unknown> = {
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
      (extractChildContent as jest.Mock).mockRejectedValue(new Error('AI error'));

      const mockSupabase: Record<string, unknown> = {
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

  describe('新規フィールド（拡張フィールド）', () => {
    const mockExtendedActivityData = {
      ...mockActivityData,
      event_name: '運動会',
      daily_schedule: [
        { time: '09:00', content: '朝の会' },
        { time: '10:00', content: '外遊び' },
        { time: '12:00', content: '昼食' },
      ],
      role_assignments: [
        { user_id: '550e8400-e29b-41d4-a716-446655440001', user_name: '山田太郎', role: '主担当' },
        { user_id: '550e8400-e29b-41d4-a716-446655440002', user_name: '佐藤花子', role: '配膳' },
      ],
      special_notes: 'アレルギー対応が必要な児童が3名います',
      meal: {
        menu: 'カレーライス',
        items_to_bring: 'フォーク、スプーン',
        notes: 'アレルギー対応済み',
      },
    };

    describe('POST - 新規フィールドを含む保育日誌の保存', () => {
      it('すべての新規フィールドを含む保育日誌を正しく保存できること', async () => {
          (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

        let insertedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
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
          body: JSON.stringify(mockExtendedActivityData),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(insertedActivity).toBeDefined();
        expect(insertedActivity.event_name).toBe('運動会');
        expect(insertedActivity.daily_schedule).toEqual(mockExtendedActivityData.daily_schedule);
        expect(insertedActivity.role_assignments).toEqual(mockExtendedActivityData.role_assignments);
        expect(insertedActivity.special_notes).toBe('アレルギー対応が必要な児童が3名います');
        expect(insertedActivity.meal).toEqual(mockExtendedActivityData.meal);
      });

      it('新規フィールドがnull/undefinedでも保存が成功すること（既存データとの互換性）', async () => {
          (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

        let insertedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
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

        const dataWithoutNewFields = {
          ...mockActivityData,
          // 新規フィールドは含まない
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'POST',
          body: JSON.stringify(dataWithoutNewFields),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(insertedActivity).toBeDefined();
        expect(insertedActivity.event_name).toBeNull();
        expect(insertedActivity.daily_schedule).toBeNull();
        expect(insertedActivity.role_assignments).toBeNull();
        expect(insertedActivity.special_notes).toBeNull();
        expect(insertedActivity.meal).toBeNull();
      });

      it('daily_scheduleが正しいJSON配列形式で保存されること', async () => {
          (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

        let insertedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
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

        const dataWithSchedule = {
          ...mockActivityData,
          daily_schedule: [
            { time: '09:00', content: '朝の会' },
            { time: '10:30', content: '外遊び' },
          ],
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'POST',
          body: JSON.stringify(dataWithSchedule),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(insertedActivity.daily_schedule).toBeDefined();
        expect(Array.isArray(insertedActivity.daily_schedule)).toBe(true);
        expect(insertedActivity.daily_schedule).toHaveLength(2);
        expect(insertedActivity.daily_schedule[0]).toHaveProperty('time');
        expect(insertedActivity.daily_schedule[0]).toHaveProperty('content');
      });

      it('role_assignmentsが正しいJSON配列形式で保存されること', async () => {
          (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

        let insertedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
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

        const dataWithRoles = {
          ...mockActivityData,
          role_assignments: [
            { user_id: '550e8400-e29b-41d4-a716-446655440001', user_name: '山田太郎', role: '主担当' },
            { user_id: '550e8400-e29b-41d4-a716-446655440002', user_name: '佐藤花子', role: '配膳' },
          ],
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'POST',
          body: JSON.stringify(dataWithRoles),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(insertedActivity.role_assignments).toBeDefined();
        expect(Array.isArray(insertedActivity.role_assignments)).toBe(true);
        expect(insertedActivity.role_assignments).toHaveLength(2);
        expect(insertedActivity.role_assignments[0]).toHaveProperty('user_id');
        expect(insertedActivity.role_assignments[0]).toHaveProperty('user_name');
        expect(insertedActivity.role_assignments[0]).toHaveProperty('role');
      });

      it('mealが正しいJSONオブジェクト形式で保存されること', async () => {
          (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

        let insertedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
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

        const dataWithMeal = {
          ...mockActivityData,
          meal: {
            menu: 'カレーライス',
            items_to_bring: 'フォーク、スプーン',
            notes: 'アレルギー対応済み',
          },
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'POST',
          body: JSON.stringify(dataWithMeal),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(insertedActivity.meal).toBeDefined();
        expect(typeof insertedActivity.meal).toBe('object');
        expect(insertedActivity.meal).toHaveProperty('menu');
        expect(insertedActivity.meal.menu).toBe('カレーライス');
        expect(insertedActivity.meal).toHaveProperty('items_to_bring');
        expect(insertedActivity.meal).toHaveProperty('notes');
      });

      it('meal.items_to_bringとmeal.notesがオプションフィールドとして機能すること', async () => {
          (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

        let insertedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
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

        const dataWithMinimalMeal = {
          ...mockActivityData,
          meal: {
            menu: 'おにぎり',
          },
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'POST',
          body: JSON.stringify(dataWithMinimalMeal),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(insertedActivity.meal).toBeDefined();
        expect(insertedActivity.meal.menu).toBe('おにぎり');
        // items_to_bringとnotesは設定されていないが、エラーにならないこと
      });
    });

    describe('PUT - 新規フィールドの更新', () => {
      // PUTメソッドのモック（ファイルには実装済み）
      it('新規フィールドの更新が成功すること', async () => {
        const { PUT } = await import('@/app/api/records/activity/route');
  
        let updatedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
          from: jest.fn((tableName: string) => {
            if (tableName === 'r_activity') {
              return {
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    is: jest.fn(() => ({
                      single: jest.fn().mockResolvedValue({
                        data: {
                          id: 'existing-activity-id',
                          facility_id: mockMetadata.current_facility_id,
                          created_by: mockMetadata.user_id,
                        },
                        error: null,
                      }),
                    })),
                  })),
                })),
                update: jest.fn((data) => {
                  updatedActivity = data;
                  return {
                    eq: jest.fn(() => ({
                      select: jest.fn().mockReturnThis(),
                      single: jest.fn().mockResolvedValue({
                        data: {
                          id: 'existing-activity-id',
                          ...data,
                        },
                        error: null,
                      }),
                    })),
                  };
                }),
              };
            }
            return mockSupabase;
          }),
        };
        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const updateData = {
          activity_id: 'existing-activity-id',
          activity_date: '2025-01-03',
          content: '更新された内容',
          mentioned_children: [],
          event_name: '遠足',
          daily_schedule: [{ time: '08:00', content: '出発' }],
          role_assignments: [{ user_id: '550e8400-e29b-41d4-a716-446655440003', user_name: '鈴木一郎', role: '引率' }],
          special_notes: '雨天の場合は延期',
          meal: { menu: 'お弁当', notes: '現地調達' },
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(updatedActivity).toBeDefined();
        expect(updatedActivity.event_name).toBe('遠足');
        expect(updatedActivity.daily_schedule).toEqual(updateData.daily_schedule);
        expect(updatedActivity.role_assignments).toEqual(updateData.role_assignments);
        expect(updatedActivity.special_notes).toBe('雨天の場合は延期');
        expect(updatedActivity.meal).toEqual(updateData.meal);
      });

      it('新規フィールドのみの部分更新が成功すること', async () => {
        const { PUT } = await import('@/app/api/records/activity/route');
  
        let updatedActivity: any = null;
        const mockSupabase: Record<string, unknown> = {
          from: jest.fn((tableName: string) => {
            if (tableName === 'r_activity') {
              return {
                select: jest.fn(() => ({
                  eq: jest.fn(() => ({
                    is: jest.fn(() => ({
                      single: jest.fn().mockResolvedValue({
                        data: {
                          id: 'existing-activity-id',
                          facility_id: mockMetadata.current_facility_id,
                          created_by: mockMetadata.user_id,
                        },
                        error: null,
                      }),
                    })),
                  })),
                })),
                update: jest.fn((data) => {
                  updatedActivity = data;
                  return {
                    eq: jest.fn(() => ({
                      select: jest.fn().mockReturnThis(),
                      single: jest.fn().mockResolvedValue({
                        data: {
                          id: 'existing-activity-id',
                          ...data,
                        },
                        error: null,
                      }),
                    })),
                  };
                }),
              };
            }
            return mockSupabase;
          }),
        };
        (createClient as jest.Mock).mockResolvedValue(mockSupabase);

        const partialUpdateData = {
          activity_id: 'existing-activity-id',
          activity_date: '2025-01-03',
          content: '既存の内容',
          mentioned_children: [],
          event_name: '新しいイベント名',
          // daily_schedule, role_assignments, special_notes, mealは更新しない
        };

        const request = new NextRequest('http://localhost:3000/api/records/activity', {
          method: 'PUT',
          body: JSON.stringify(partialUpdateData),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(updatedActivity).toBeDefined();
        expect(updatedActivity.event_name).toBe('新しいイベント名');
        expect(updatedActivity.daily_schedule).toBeNull();
        expect(updatedActivity.role_assignments).toBeNull();
        expect(updatedActivity.special_notes).toBeNull();
        expect(updatedActivity.meal).toBeNull();
      });
    });
  });

  describe('todo_items の保存・更新', () => {
    it('POST: todo_itemsを含む保存リクエストでDBに正しく挿入される', async () => {
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let insertedActivity: any = null;
      const mockSupabase: Record<string, unknown> = {
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn((data) => {
                insertedActivity = data;
                return {
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'test-activity-id', ...data },
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
                  data: { id: 'test-observation-id', content: '抽出された内容' },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const todoItems = [{ id: 'todo-1', content: 'テスト項目', completed: false }];
      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify({ ...mockActivityData, todo_items: todoItems }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(insertedActivity).toBeDefined();
      expect(insertedActivity.todo_items).toEqual(todoItems);
    });

    it('POST: todo_itemsを省略した場合、todo_items: nullとして保存される', async () => {
      (extractChildContent as jest.Mock).mockResolvedValue('抽出された内容');

      let insertedActivity: any = null;
      const mockSupabase: Record<string, unknown> = {
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              insert: jest.fn((data) => {
                insertedActivity = data;
                return {
                  select: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'test-activity-id', ...data },
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
                  data: { id: 'test-observation-id', content: '抽出された内容' },
                  error: null,
                }),
              })),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      // todo_items を省略（クライアント側で空 content を除外してから送信するため、APIには undefined/null を渡す）
      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'POST',
        body: JSON.stringify({ ...mockActivityData }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(insertedActivity).toBeDefined();
      expect(insertedActivity.todo_items).toBeNull();
    });

    it('PUT: todo_itemsを含む更新リクエストでDBに正しく更新される', async () => {
      const { PUT } = await import('@/app/api/records/activity/route');

      let updatedActivity: any = null;
      const mockSupabase: Record<string, unknown> = {
        from: jest.fn((tableName: string) => {
          if (tableName === 'r_activity') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  is: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({
                      data: {
                        id: 'existing-activity-id',
                        facility_id: mockMetadata.current_facility_id,
                        created_by: mockMetadata.user_id,
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
              update: jest.fn((data) => {
                updatedActivity = data;
                return {
                  eq: jest.fn(() => ({
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                      data: { id: 'existing-activity-id', ...data },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }
          return mockSupabase;
        }),
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const todoItems = [{ id: 'todo-1', content: 'テスト項目', completed: true }];
      const updateData = {
        activity_id: 'existing-activity-id',
        activity_date: '2025-01-03',
        content: '更新された内容',
        mentioned_children: [],
        todo_items: todoItems,
      };

      const request = new NextRequest('http://localhost:3000/api/records/activity', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
      expect(updatedActivity).toBeDefined();
      expect(updatedActivity.todo_items).toEqual(todoItems);
    });
  });
});
