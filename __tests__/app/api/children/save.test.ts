/**
 * @jest-environment node
 */
import { saveChild, type ChildPayload } from '@/app/api/children/save/route';
import { decryptPII } from '@/utils/crypto/piiEncryption';
import { normalizePhone } from '@/lib/children/import-csv';

jest.mock('@/utils/pii/searchIndex', () => ({
  updateSearchIndex: jest.fn().mockResolvedValue(undefined),
  searchByPhone: jest.fn().mockResolvedValue([]),
  searchByEmail: jest.fn().mockResolvedValue([]),
  deleteSearchIndex: jest.fn().mockResolvedValue(undefined),
}));

type SupabaseMock = {
  from: jest.Mock;
  __childInsert: jest.Mock;
  __guardianInsert: jest.Mock;
  __childGuardianUpsert: jest.Mock;
};

const createSupabaseMock = (childId = 'child-1', guardianId = 'guardian-1'): SupabaseMock => {
  const childInsert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: {
          id: childId,
          family_name: 'encrypted',
          given_name: 'encrypted',
          family_name_kana: 'encrypted',
          given_name_kana: 'encrypted',
          birth_date: '2020-01-01',
          grade_add: 0,
          enrollment_date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      }),
    }),
  });

  const guardianInsert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: { id: guardianId },
        error: null,
      }),
    }),
  });

  const childGuardianUpsert = jest.fn().mockResolvedValue({ error: null });

  const from = jest.fn((table: string) => {
    switch (table) {
      case 'm_children':
        return { insert: childInsert };
      case 'm_guardians':
        return { insert: guardianInsert };
      case '_child_guardian':
        return { upsert: childGuardianUpsert };
      default:
        return {};
    }
  });

  return {
    from,
    __childInsert: childInsert,
    __guardianInsert: guardianInsert,
    __childGuardianUpsert: childGuardianUpsert,
  };
};

type SupabaseUpdateMock = {
  from: jest.Mock;
  __childSelect: jest.Mock;
  __childUpdate: jest.Mock;
  __childGuardianSelect: jest.Mock;
  __childGuardianDelete: jest.Mock;
};

const createSupabaseUpdateMock = (childId = 'child-1'): SupabaseUpdateMock => {
  const childSelect = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: childId },
            error: null,
          }),
        }),
      }),
    }),
  });

  const childUpdate = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: childId,
            family_name: 'encrypted',
            given_name: 'encrypted',
            family_name_kana: 'encrypted',
            given_name_kana: 'encrypted',
            enrollment_date: '2024-01-01',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
          error: null,
        }),
      }),
    }),
  });

  const childGuardianSelect = jest.fn();
  const childGuardianDelete = jest.fn();

  const from = jest.fn((table: string) => {
    switch (table) {
      case 'm_children':
        return { select: childSelect, update: childUpdate };
      case '_child_guardian':
        return { select: childGuardianSelect, delete: childGuardianDelete };
      default:
        return {};
    }
  });

  return {
    from,
    __childSelect: childSelect,
    __childUpdate: childUpdate,
    __childGuardianSelect: childGuardianSelect,
    __childGuardianDelete: childGuardianDelete,
  };
};

describe('saveChild PII暗号化', () => {
  const originalKey = process.env.PII_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.PII_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
  });

  afterAll(() => {
    if (originalKey) {
      process.env.PII_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.PII_ENCRYPTION_KEY;
    }
  });

  it('児童の氏名・フリガナを暗号化して保存すること', async () => {
    const supabase = createSupabaseMock();
    const payload: ChildPayload = {
      basic_info: {
        family_name: '山田',
        given_name: '太郎',
        family_name_kana: 'ヤマダ',
        given_name_kana: 'タロウ',
        birth_date: '2020-01-01',
      },
      affiliation: {
        enrolled_at: '2024-04-01',
      },
    };

    await saveChild(payload, 'facility-1', supabase);

    const insertedValues = supabase.__childInsert.mock.calls[0][0];

    expect(insertedValues.family_name.length).toBeLessThanOrEqual(50);
    expect(insertedValues.family_name).not.toBe(payload.basic_info?.family_name);
    expect(decryptPII(insertedValues.family_name)).toBe(payload.basic_info?.family_name);

    expect(insertedValues.given_name.length).toBeLessThanOrEqual(50);
    expect(insertedValues.given_name).not.toBe(payload.basic_info?.given_name);
    expect(decryptPII(insertedValues.given_name)).toBe(payload.basic_info?.given_name);

    expect(insertedValues.family_name_kana.length).toBeLessThanOrEqual(50);
    expect(insertedValues.family_name_kana).not.toBe(payload.basic_info?.family_name_kana);
    expect(decryptPII(insertedValues.family_name_kana)).toBe(payload.basic_info?.family_name_kana);

    expect(insertedValues.given_name_kana.length).toBeLessThanOrEqual(50);
    expect(insertedValues.given_name_kana).not.toBe(payload.basic_info?.given_name_kana);
    expect(decryptPII(insertedValues.given_name_kana)).toBe(payload.basic_info?.given_name_kana);
  });

  it('保護者情報の暗号化とレガシーカラム保存に対応すること', async () => {
    const supabase = createSupabaseMock();
    const payload: ChildPayload = {
      basic_info: {
        family_name: '佐藤',
        given_name: '花子',
        birth_date: '2019-06-01',
      },
      affiliation: {
        enrolled_at: '2024-04-01',
      },
      contact: {
        parent_name: '田中 優子',
        parent_phone: '090-1111-2222',
        parent_email: 'yuko@example.com',
      },
    };

    await saveChild(payload, 'facility-1', supabase);

    const insertedValues = supabase.__childInsert.mock.calls[0][0];
    const normalizedParentPhone = normalizePhone(payload.contact?.parent_phone || '');

    expect(insertedValues.parent_name).not.toBe(payload.contact?.parent_name);
    expect(decryptPII(insertedValues.parent_name)).toBe(payload.contact?.parent_name);

    expect(insertedValues.parent_phone).toBeNull();

    expect(insertedValues.parent_email).not.toBe(payload.contact?.parent_email);
    expect(decryptPII(insertedValues.parent_email)).toBe(payload.contact?.parent_email);

    const guardianInsertValues = supabase.__guardianInsert.mock.calls[0][0];
    expect(decryptPII(guardianInsertValues.family_name)).toBe('田中');
    expect(decryptPII(guardianInsertValues.given_name)).toBe('優子');
    expect(decryptPII(guardianInsertValues.phone)).toBe(normalizedParentPhone);
    expect(decryptPII(guardianInsertValues.email)).toBe(payload.contact?.parent_email);
  });

  it('保護者情報が空欄の更新では既存の紐付けを削除しないこと', async () => {
    const supabase = createSupabaseUpdateMock();
    const payload: ChildPayload = {
      basic_info: {
        family_name: '佐藤',
        given_name: '花子',
        birth_date: '2019-06-01',
      },
      affiliation: {
        enrolled_at: '2024-04-01',
      },
      contact: {
        parent_name: '',
        parent_phone: '',
      },
    };

    await saveChild(payload, 'facility-1', supabase, 'child-1');

    const updateValues = supabase.__childUpdate.mock.calls[0][0];
    expect(updateValues.parent_name).toBeUndefined();
    expect(updateValues.parent_phone).toBeUndefined();
    expect(updateValues.parent_email).toBeUndefined();

    expect(supabase.__childGuardianSelect).not.toHaveBeenCalled();
    expect(supabase.__childGuardianDelete).not.toHaveBeenCalled();
  });
});
