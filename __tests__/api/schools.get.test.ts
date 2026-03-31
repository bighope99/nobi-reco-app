import { NextRequest } from 'next/server';
import { GET } from '@/app/api/schools/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/jwt', () => ({
  getAuthenticatedUserMetadata: jest.fn(),
}));

describe('GET /api/schools', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
  const mockedGetAuthenticatedUserMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
    typeof getAuthenticatedUserMetadata
  >;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('ケース1: facility_admin として学校一覧を取得できる', async () => {
    // Given: facility_admin ユーザーが認証済み
    mockedGetAuthenticatedUserMetadata.mockResolvedValue({
      role: 'facility_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    } as any);

    const facilitiesQuery: any = {
      select: jest.fn(() => facilitiesQuery),
      eq: jest.fn(() => facilitiesQuery),
      single: jest.fn().mockResolvedValue({
        data: { company_id: 'company-1' },
        error: null,
      }),
    };

    const schoolsQuery: any = {
      select: jest.fn(() => schoolsQuery),
      eq: jest.fn(() => schoolsQuery),
      is: jest.fn(() => schoolsQuery),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'school-1',
            name: '北小学校',
            address: '東京都新宿区1-2-3',
            phone: '03-1234-5678',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            _school_facility: [{ facility_id: 'facility-1', late_threshold_minutes: 45 }],
          },
        ],
        error: null,
      }),
    };

    const schedulesQuery: any = {
      select: jest.fn(() => schedulesQuery),
      eq: jest.fn(() => schedulesQuery),
      is: jest.fn(() => schedulesQuery),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'schedule-1',
            school_id: 'school-1',
            grades: ['1'],
            monday_time: '08:30',
            tuesday_time: null,
            wednesday_time: null,
            thursday_time: null,
            friday_time: null,
            saturday_time: null,
            sunday_time: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_facilities') return facilitiesQuery;
        if (table === 'm_schools') return schoolsQuery;
        if (table === 's_school_schedules') return schedulesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    // When: GET /api/schools を呼び出す
    const request = new NextRequest('http://localhost/api/schools');
    const response = await GET(request);
    const json = await response.json();

    // Then: 学校一覧が正常に返る
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.schools[0]).toEqual(
      expect.objectContaining({
        school_id: 'school-1',
        name: '北小学校',
        late_threshold_minutes: 45,
      })
    );
    expect(json.data.schools[0].schedules[0]).toEqual(
      expect.objectContaining({
        schedule_id: 'schedule-1',
        grades: ['1'],
      })
    );
  });

  it('ケース2: company_admin として学校一覧を取得できる', async () => {
    // Given: company_admin ユーザーが認証済み（施設クエリなしで直接 company_id を使用）
    mockedGetAuthenticatedUserMetadata.mockResolvedValue({
      role: 'company_admin',
      company_id: 'company-1',
      current_facility_id: 'facility-1',
    } as any);

    const schoolsQuery: any = {
      select: jest.fn(() => schoolsQuery),
      eq: jest.fn(() => schoolsQuery),
      is: jest.fn(() => schoolsQuery),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'school-1',
            name: '北小学校',
            address: '東京都新宿区1-2-3',
            phone: '03-1234-5678',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            _school_facility: [{ facility_id: 'facility-1', late_threshold_minutes: 45 }],
          },
        ],
        error: null,
      }),
    };

    const schedulesQuery: any = {
      select: jest.fn(() => schedulesQuery),
      eq: jest.fn(() => schedulesQuery),
      is: jest.fn(() => schedulesQuery),
      order: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_schools') return schoolsQuery;
        if (table === 's_school_schedules') return schedulesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    // When: GET /api/schools を呼び出す
    const request = new NextRequest('http://localhost/api/schools');
    const response = await GET(request);
    const json = await response.json();

    // Then: 施設クエリなしで学校一覧が正常に返る
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.schools).toHaveLength(1);
    expect(json.data.schools[0]).toEqual(
      expect.objectContaining({
        school_id: 'school-1',
        name: '北小学校',
        late_threshold_minutes: 45,
      })
    );
    // m_facilities クエリが呼ばれていないことを確認
    expect(mockSupabase.from).not.toHaveBeenCalledWith('m_facilities');
  });

  it('ケース3: 未認証の場合は401を返す', async () => {
    // Given: JWTメタデータがnull（未認証）
    mockedGetAuthenticatedUserMetadata.mockResolvedValue(null);

    const mockSupabase = {
      from: jest.fn(),
    };
    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    // When: GET /api/schools を呼び出す
    const request = new NextRequest('http://localhost/api/schools');
    const response = await GET(request);
    const json = await response.json();

    // Then: 401 Unauthorized が返る
    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: 'Unauthorized' });
  });
});
