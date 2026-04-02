/** @jest-environment node */
/**
 * 活動記録テンプレートAPIのテスト
 * GET /api/activity-templates
 * POST /api/activity-templates
 */

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

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

const ADMIN_METADATA = {
  ...BASE_METADATA,
  role: 'facility_admin' as const,
};

describe('GET /api/activity-templates', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetAuthenticatedUserMetadata.mockResolvedValue(BASE_METADATA);
  });

  it('施設のテンプレート一覧を返す', async () => {
    const templates = [
      {
        id: 'template-1',
        name: '通常日程',
        event_name: null,
        daily_schedule: [{ time: '10:00', content: '朝の会' }],
        created_by: 'user-123',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    const mockSelect = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: templates, error: null }),
    };
    mockSupabase.from.mockReturnValue(mockSelect);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].name).toBe('通常日程');
  });

  it('未認証の場合 401 を返す', async () => {
    mockGetAuthenticatedUserMetadata.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });
});

describe('POST /api/activity-templates', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockGetAuthenticatedUserMetadata.mockResolvedValue(BASE_METADATA);
  });

  const makeRequest = (body: object) =>
    new NextRequest('http://localhost/api/activity-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('テンプレートを正常に作成できる', async () => {
    const newTemplate = {
      id: 'template-new',
      facility_id: 'facility-123',
      name: '通常日程',
      event_name: null,
      daily_schedule: [{ time: '10:00', content: '朝の会' }],
      created_by: 'user-123',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: newTemplate, error: null }),
    };
    mockSupabase.from.mockReturnValue(mockChain);

    const response = await POST(
      makeRequest({
        name: '通常日程',
        event_name: null,
        daily_schedule: [{ time: '10:00', content: '朝の会' }],
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.template.name).toBe('通常日程');
  });

  it('name が空の場合 400 を返す', async () => {
    const response = await POST(makeRequest({ name: '', event_name: null }));
    expect(response.status).toBe(400);
  });

  it('name が101文字以上の場合 400 を返す', async () => {
    const response = await POST(makeRequest({ name: 'a'.repeat(101) }));
    expect(response.status).toBe(400);
  });

  it('daily_schedule が配列でない場合 400 を返す', async () => {
    const response = await POST(
      makeRequest({
        name: 'テスト',
        daily_schedule: 'not-an-array',
      })
    );
    expect(response.status).toBe(400);
  });
});
