jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const { saveChild } = require('@/app/api/children/save/route');

describe('saveChild', () => {
  it('stores parent_name on child records for backward compatibility', async () => {
    const insertQuery: any = {
      insert: jest.fn(() => insertQuery),
      select: jest.fn(() => insertQuery),
      eq: jest.fn(() => insertQuery),
      is: jest.fn(() => insertQuery),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn(() => insertQuery),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'child-1',
          family_name: '山田',
          given_name: '花子',
          family_name_kana: 'ヤマダ',
          given_name_kana: 'ハナコ',
          birth_date: '2019-04-12',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          created_at: '2024-04-01T00:00:00.000Z',
          updated_at: '2024-04-01T00:00:00.000Z',
        },
        error: null,
      }),
    };

    const mockSupabase: any = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') return insertQuery;
        return insertQuery;
      }),
    };

    const payload = {
      basic_info: {
        family_name: '山田',
        given_name: '花子',
        birth_date: '2019-04-12',
        gender: 'female',
      },
      affiliation: {
        enrolled_at: '2024-04-01',
      },
      contact: {
        parent_name: '山田 太郎',
        parent_phone: '090-1234-5678',
        parent_email: 'taro@example.com',
      },
      permissions: {},
    };

    const response = await saveChild(payload, 'facility-1', mockSupabase);

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parent_name: '山田 太郎',
        parent_phone: '090-1234-5678',
        parent_email: 'taro@example.com',
      })
    );
    expect(response.status).toBe(201);
  });

  it('creates guardians and emergency contacts and links them to child', async () => {
    const childInsertQuery: any = {
      insert: jest.fn(() => childInsertQuery),
      select: jest.fn(() => childInsertQuery),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'child-1',
          family_name: '山田',
          given_name: '花子',
          family_name_kana: 'ヤマダ',
          given_name_kana: 'ハナコ',
          birth_date: '2019-04-12',
          enrolled_at: '2024-04-01T00:00:00.000Z',
          created_at: '2024-04-01T00:00:00.000Z',
          updated_at: '2024-04-01T00:00:00.000Z',
        },
        error: null,
      }),
    };

    const guardianInsertQuery: any = {
      insert: jest.fn(() => guardianInsertQuery),
      select: jest.fn(() => guardianInsertQuery),
      eq: jest.fn(() => guardianInsertQuery),
      is: jest.fn(() => guardianInsertQuery),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn(() => guardianInsertQuery),
      single: jest.fn()
        .mockResolvedValueOnce({
          data: {
            id: 'guardian-1',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'guardian-2',
          },
          error: null,
        }),
    };

    const childGuardianInsertQuery: any = {
      insert: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      upsert: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const childClassInsertQuery: any = {
      insert: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const mockSupabase: any = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') return childInsertQuery;
        if (table === 'm_guardians') {
          return guardianInsertQuery;
        }
        if (table === '_child_guardian') return childGuardianInsertQuery;
        if (table === '_child_class') return childClassInsertQuery;
        return childInsertQuery;
      }),
    };

    const payload = {
      basic_info: {
        family_name: '山田',
        given_name: '花子',
        birth_date: '2019-04-12',
        gender: 'female',
      },
      affiliation: {
        enrolled_at: '2024-04-01',
      },
      contact: {
        parent_name: '山田 太郎',
        parent_phone: '090-1234-5678',
        parent_email: 'taro@example.com',
        emergency_contacts: [
          {
            name: '佐藤 次郎',
            relation: '叔父',
            phone: '090-8765-4321',
          },
        ],
      },
      permissions: {},
    };

    const response = await saveChild(payload, 'facility-1', mockSupabase);

    // Verify m_guardians was called
    expect(mockSupabase.from).toHaveBeenCalledWith('m_guardians');
    
    // Verify primary guardian creation
    expect(guardianInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        facility_id: 'facility-1',
        family_name: '山田',
        given_name: '太郎',
        phone: '09012345678',
        email: 'taro@example.com',
      })
    );

    // Verify emergency contact guardian creation
    expect(guardianInsertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        facility_id: 'facility-1',
        family_name: '佐藤',
        given_name: '次郎',
        phone: '09087654321',
      })
    );

    // Verify _child_guardian was called
    expect(mockSupabase.from).toHaveBeenCalledWith('_child_guardian');

    // Verify primary guardian linking
    expect(childGuardianInsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'child-1',
        guardian_id: 'guardian-1',
        relationship: '保護者',
        is_primary: true,
        is_emergency_contact: true,
      }),
      expect.any(Object)
    );

    // Verify emergency contact linking
    expect(childGuardianInsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        child_id: 'child-1',
        guardian_id: 'guardian-2',
        relationship: '叔父',
        is_primary: false,
        is_emergency_contact: true,
      }),
      expect.any(Object)
    );

    expect(response.status).toBe(201);
  });
});
