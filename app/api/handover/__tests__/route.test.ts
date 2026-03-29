/** @jest-environment node */
/**
 * 引き継ぎ表示API テスト
 * GET /api/handover
 */

import { GET } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server');
jest.mock('@/lib/auth/jwt');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<typeof getAuthenticatedUserMetadata>;

describe('GET /api/handover', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);

    mockGetAuthenticatedUserMetadata.mockResolvedValue({
      user_id: 'user-123',
      role: 'staff',
      company_id: 'company-123',
      current_facility_id: 'facility-123',
    });
  });

  it('dateパラメータが無い場合は400を返す', async () => {
    const request = new NextRequest('http://localhost/api/handover');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('date');
  });

  it('無効な日付形式の場合は400を返す', async () => {
    const request = new NextRequest('http://localhost/api/handover?date=invalid');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('認証されていない場合は401を返す', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/handover?date=2026-03-22');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('引き継ぎがない場合は空配列を返す', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockQuery);

    const request = new NextRequest('http://localhost/api/handover?date=2026-03-22');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toEqual([]);
    expect(body.data.handover_date).toBeNull();
  });

  it('引き継ぎデータとhas_next_recordフラグを返す', async () => {
    // handover取得クエリ
    const mockHandoverQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'activity-1',
            activity_date: '2026-03-21',
            handover: '明日は運動会の準備を',
            handover_completed: false,
            class_id: 'class-1',
            m_classes: { id: 'class-1', name: 'ひまわり組' },
            m_users: { id: 'user-1', name: '田中先生' },
          },
        ],
        error: null,
      }),
    };

    // next record チェッククエリ
    const mockNextRecordQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({
        count: 0,
        data: null,
        error: null,
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockHandoverQuery;
      return mockNextRecordQuery;
    });

    const request = new NextRequest('http://localhost/api/handover?date=2026-03-22');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.handover_date).toBe('2026-03-21');
    expect(body.data.has_next_record).toBe(false);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].handover).toBe('明日は運動会の準備を');
    expect(body.data.items[0].handover_completed).toBe(false);
    expect(body.data.items[0].class_name).toBe('ひまわり組');
    expect(body.data.items[0].created_by_name).toBe('田中先生');
  });

  it('class_idが無効なUUID形式の場合は400を返す', async () => {
    const request = new NextRequest('http://localhost/api/handover?date=2026-03-22&class_id=invalid');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('class_id');
  });
});
