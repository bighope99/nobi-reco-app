/**
 * @jest-environment node
 *
 * staff_idフィルター（記入者絞り込み）の動作確認テスト
 *
 * 修正内容:
 *   活動記録・個別記録ともに、記入者フィルターは recorded_by のみで絞り込む。
 *   created_by は「システム上の作成者」であり「記入者」表示とは別概念のため除外。
 *
 *   修正前: or(created_by.eq.X, recorded_by.eq.X)  → 作成者が一致すると全件表示になる
 *   修正後: recorded_by.eq.X のみ                  → 表示上の「記入者」のみで絞り込み
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/activities/route';

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { createClient } from '@/utils/supabase/server';

const STAFF_A_ID = 'a2029c9c-9887-48f8-ba60-eac88a46d7ff'; // recorded_byに設定されているスタッフ
const STAFF_B_ID = '144fc806-b530-4add-ab50-aba86b4728b6'; // created_byのみのアカウントユーザー

const mockMetadata = {
  user_id: 'test-user-uuid',
  role: 'facility_admin' as const,
  company_id: 'test-company-id',
  current_facility_id: 'test-facility-id',
};

// 3件のテストデータ
// - activity-1: recorded_by = STAFF_A（スタッフAが記入者）
// - activity-2: recorded_by = null, created_by = STAFF_B（アカウントユーザーが作成、記入者未設定）
// - activity-3: recorded_by = null, created_by = STAFF_B（同上）
const mockActivities = [
  {
    id: 'activity-1',
    facility_id: 'test-facility-id',
    activity_date: '2026-01-10',
    title: 'スタッフAの活動',
    content: '活動内容A',
    snack: null, photos: null, class_id: 'class-1',
    mentioned_children: [], event_name: null, daily_schedule: null,
    role_assignments: null, special_notes: null, handover: null, meal: null,
    recorded_by: STAFF_A_ID,
    created_at: '2026-01-10T10:00:00Z', updated_at: '2026-01-10T10:00:00Z',
    m_classes: { id: 'class-1', name: 'ひまわり組' },
    m_users: { id: STAFF_B_ID, name: 'アカウントユーザー' },
    recorded_by_user: { id: STAFF_A_ID, name: 'スタッフA' },
  },
  {
    id: 'activity-2',
    facility_id: 'test-facility-id',
    activity_date: '2026-01-09',
    title: 'アカウントユーザーが作成（記入者未設定）',
    content: '活動内容B',
    snack: null, photos: null, class_id: 'class-1',
    mentioned_children: [], event_name: null, daily_schedule: null,
    role_assignments: null, special_notes: null, handover: null, meal: null,
    recorded_by: null,
    created_at: '2026-01-09T10:00:00Z', updated_at: '2026-01-09T10:00:00Z',
    m_classes: { id: 'class-1', name: 'ひまわり組' },
    m_users: { id: STAFF_B_ID, name: 'アカウントユーザー' },
    recorded_by_user: null,
  },
  {
    id: 'activity-3',
    facility_id: 'test-facility-id',
    activity_date: '2026-01-08',
    title: 'アカウントユーザーが作成（記入者未設定）2',
    content: '活動内容C',
    snack: null, photos: null, class_id: 'class-1',
    mentioned_children: [], event_name: null, daily_schedule: null,
    role_assignments: null, special_notes: null, handover: null, meal: null,
    recorded_by: null,
    created_at: '2026-01-08T10:00:00Z', updated_at: '2026-01-08T10:00:00Z',
    m_classes: { id: 'class-1', name: 'ひまわり組' },
    m_users: { id: STAFF_B_ID, name: 'アカウントユーザー' },
    recorded_by_user: null,
  },
];

/** or/eq 呼び出しを追跡できる Supabase モック */
function buildMockSupabase(activities: typeof mockActivities) {
  const orMock = jest.fn();
  const eqMock = jest.fn();

  const resolvedValue = { data: activities, error: null, count: activities.length };

  function buildChain(): any {
    const chain: any = {
      select: jest.fn().mockImplementation(() => buildChain()),
      eq: jest.fn().mockImplementation((...args: any[]) => { eqMock(...args); return buildChain(); }),
      is: jest.fn().mockImplementation(() => buildChain()),
      or: jest.fn().mockImplementation((...args: any[]) => { orMock(...args); return buildChain(); }),
      gte: jest.fn().mockImplementation(() => buildChain()),
      lte: jest.fn().mockImplementation(() => buildChain()),
      order: jest.fn().mockImplementation(() => buildChain()),
      range: jest.fn().mockImplementation(() => buildChain()),
      then: jest.fn().mockImplementation((resolve: (v: any) => any) =>
        Promise.resolve(resolvedValue).then(resolve)
      ),
      catch: jest.fn().mockImplementation((reject: (e: any) => any) =>
        Promise.resolve(resolvedValue).catch(reject)
      ),
    };
    return chain;
  }

  const mockSupabase: any = {
    storage: { from: jest.fn(() => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }) })) },
    from: jest.fn((tableName: string) => {
      if (tableName === 'r_activity') return buildChain();
      if (tableName === 'r_observation') {
        return { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), is: jest.fn().mockResolvedValue({ data: [], error: null }) };
      }
      return mockSupabase;
    }),
    _orMock: orMock,
    _eqMock: eqMock,
  };
  return mockSupabase;
}

describe('/api/activities GET - 記入者フィルター（recorded_byのみ）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedUserMetadata as jest.Mock).mockResolvedValue(mockMetadata);
  });

  it('staff_id指定時に created_by ではなく recorded_by のみでフィルターされること', async () => {
    const mockSupabase = buildMockSupabase(mockActivities);
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const request = new NextRequest(
      `http://localhost:3000/api/activities?staff_id=${STAFF_A_ID}&limit=20`
    );
    await GET(request);

    // or() の引数に recorded_by のみが含まれること
    expect(mockSupabase._orMock).toHaveBeenCalled();
    const orArg = mockSupabase._orMock.mock.calls[0][0] as string;
    expect(orArg).toContain(`recorded_by.eq.${STAFF_A_ID}`);
    expect(orArg).not.toContain('created_by');
  });

  it('アカウントユーザー（created_byのみ）で絞り込んでも created_by フィルターが発行されないこと', async () => {
    const mockSupabase = buildMockSupabase(mockActivities);
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const request = new NextRequest(
      `http://localhost:3000/api/activities?staff_id=${STAFF_B_ID}&limit=20`
    );
    await GET(request);

    // or() が呼ばれた場合、created_by を含まないこと
    if (mockSupabase._orMock.mock.calls.length > 0) {
      const orArg = mockSupabase._orMock.mock.calls[0][0] as string;
      expect(orArg).not.toContain('created_by');
    }
    // or() が呼ばれなかった場合は eq('recorded_by', ...) になっているはず
  });

  it('staff_idなしのリクエストでは recorded_by フィルターが発行されないこと', async () => {
    const mockSupabase = buildMockSupabase(mockActivities);
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const request = new NextRequest('http://localhost:3000/api/activities?limit=20');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.activities).toHaveLength(3);
    // staff_idなしのときはスタッフフィルター用の or() は呼ばれない
    const orCallsWithStaffFilter = mockSupabase._orMock.mock.calls.filter(
      (args: any[]) => args[0]?.includes('recorded_by.eq.')
    );
    expect(orCallsWithStaffFilter).toHaveLength(0);
  });

  it('キーワードとstaff_idを同時指定した場合も created_by が含まれないこと', async () => {
    const mockSupabase = buildMockSupabase(mockActivities);
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);

    const request = new NextRequest(
      `http://localhost:3000/api/activities?staff_id=${STAFF_A_ID}&keyword=活動&limit=20`
    );
    await GET(request);

    expect(mockSupabase._orMock).toHaveBeenCalled();
    const orArg = mockSupabase._orMock.mock.calls[0][0] as string;
    expect(orArg).toContain(`recorded_by.eq.${STAFF_A_ID}`);
    expect(orArg).not.toContain('created_by');
  });
});
