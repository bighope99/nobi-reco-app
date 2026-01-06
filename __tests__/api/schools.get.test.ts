import { NextRequest } from 'next/server';
import { GET } from '@/app/api/schools/route';
import { createClient } from '@/utils/supabase/server';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('GET /api/schools', () => {
  const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns schools for the current facility', async () => {
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
      auth: {
        getClaims: jest.fn().mockResolvedValue({
          data: {
            claims: {
              app_metadata: {
                role: 'facility_admin',
                company_id: 'company-1',
                current_facility_id: 'facility-1',
              },
            },
          },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'm_schools') return schoolsQuery;
        if (table === 's_school_schedules') return schedulesQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    mockedCreateClient.mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost/api/schools');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.schools[0]).toEqual(
      expect.objectContaining({
        school_id: 'school-1',
        name: '北小学校',
      })
    );
    expect(json.data.schools[0].schedules[0]).toEqual(
      expect.objectContaining({
        schedule_id: 'schedule-1',
        grades: ['1'],
      })
    );
  });
});
