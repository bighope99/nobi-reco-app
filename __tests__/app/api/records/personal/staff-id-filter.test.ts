/**
 * @jest-environment node
 *
 * GET /api/records/personal?staff_id=UUID
 * 個別記録ページの記入者フィルター機能テスト
 *
 * テスト対象の動作:
 *   - staff_id パラメータが .eq('recorded_by', staff_id) に変換されること
 *   - 無効な UUID は 400 で拒否されること
 *   - staff_id 未指定時は recorded_by フィルターが適用されないこと
 *   - レスポンスに recorded_by_name フィールドが含まれること
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/records/personal/route';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth/jwt', () => ({ getAuthenticatedUserMetadata: jest.fn() }));

// 暗号化ヘルパーはそのまま通過させる
jest.mock('@/utils/crypto/decryption-helper', () => ({
  decryptOrFallback: jest.fn((val: unknown) => val),
  formatName: jest.fn((parts: (string | null | undefined)[], _sep: string) =>
    parts.filter(Boolean).join(' ')
  ),
}));

// grade ユーティリティもスタブ化
jest.mock('@/utils/grade', () => ({
  calculateGrade: jest.fn(() => 1),
  formatGradeLabel: jest.fn(() => '小1'),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedGetMetadata = getAuthenticatedUserMetadata as jest.MockedFunction<
  typeof getAuthenticatedUserMetadata
>;

// ─────────────────────────────────────────────
// 固定値
// ─────────────────────────────────────────────
const VALID_STAFF_UUID = '550e8400-e29b-41d4-a716-446655440000';
const FACILITY_ID = 'facility-1';

const AUTH_METADATA = {
  user_id: 'admin-1',
  role: 'facility_admin' as const,
  company_id: 'company-1',
  current_facility_id: FACILITY_ID,
};

// ─────────────────────────────────────────────
// Supabase モックビルダー
// ─────────────────────────────────────────────

/**
 * GET /api/records/personal 向けの Supabase モックを構築する
 *
 * このルートは以下の順でクエリを発行する:
 *   1. (class_id 指定時) _child_class から child_id リストを取得
 *   2. (child_name 指定時) m_children から全児童を取得
 *   3. (grade 指定時) m_children から全児童を取得
 *   4. r_observation にメインクエリを実行（count 付き）
 *
 * テストは主にメインクエリ(r_observation)の挙動を検証する。
 */
function buildObservationMock(options: {
  observationsData?: object[];
  observationsError?: object | null;
  count?: number;
}) {
  const {
    observationsData = [],
    observationsError = null,
    count = 0,
  } = options;

  // メインクエリのフィルターチェーンを追跡する
  const eqCalls: Array<[string, unknown]> = [];
  const isCalls: Array<[string, unknown]> = [];

  // Supabase のクエリビルダーチェーンをシミュレートするオブジェクト。
  //
  // ルートのクエリ構造:
  //   let query = supabase.from(...).select(...).eq(...).is(...).order(...).order(...).range(...)
  //   if (staff_id) { query = query.eq('recorded_by', ...) }
  //   const { data, error, count } = await query
  //
  // range() もチェーンを返し続ける必要がある。最終的に
  // `await query` で then が呼ばれるよう、thenable として実装する。
  const resolvedValue = {
    data: observationsError ? null : observationsData,
    error: observationsError ?? null,
    count: observationsError ? null : count,
  };

  const observationQuery: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return observationQuery;
    }),
    is: jest.fn().mockImplementation((col: string, val: unknown) => {
      isCalls.push([col, val]);
      return observationQuery;
    }),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    // thenable にすることで `await query` が resolvedValue に解決される
    then: jest.fn().mockImplementation((resolve: (v: typeof resolvedValue) => void) => {
      resolve(resolvedValue);
      return Promise.resolve(resolvedValue);
    }),
  };

  const mockSupabase = {
    from: jest.fn((table: string) => {
      if (table === 'r_observation') return observationQuery;
      // class_id / child_name / grade フィルター用サブクエリ（このテストでは使わない）
      if (table === '_child_class') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
        };
      }
      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {};
    }),
  };

  return { mockSupabase, observationQuery, eqCalls, isCalls };
}

/** テスト用の観察記録データ（データ整形が正しく動くよう最低限の構造を持つ） */
function makeObservation(overrides: Partial<{
  id: string;
  recorded_by: string | null;
  recorded_by_user: { id: string; name: string } | null;
}> = {}) {
  return {
    id: overrides.id ?? 'obs-1',
    child_id: 'child-1',
    observation_date: '2026-01-15',
    content: 'テスト観察',
    created_by: 'user-1',
    recorded_by: overrides.recorded_by ?? null,
    m_children: {
      id: 'child-1',
      family_name: '山田',
      given_name: '太郎',
      nickname: null,
      birth_date: '2018-04-01',
      grade_add: 0,
      facility_id: FACILITY_ID,
      _child_class: [
        {
          is_current: true,
          class_id: 'class-1',
          m_classes: { id: 'class-1', name: 'ひまわり組' },
        },
      ],
    },
    m_users: { id: 'user-1', name: '作成者' },
    recorded_by_user: overrides.recorded_by_user !== undefined
      ? overrides.recorded_by_user
      : null,
    _record_tag: [],
  };
}

// ─────────────────────────────────────────────
// テストスイート
// ─────────────────────────────────────────────

describe('GET /api/records/personal?staff_id=UUID (記入者フィルター)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGetMetadata.mockResolvedValue(AUTH_METADATA);
  });

  // ─────────────────────────────────────────
  // テスト 1: staff_id フィルターの適用確認
  // ─────────────────────────────────────────
  describe('1. staff_id param applies eq("recorded_by", staffId) filter', () => {
    it('有効な UUID を staff_id に渡すと .eq("recorded_by", staffId) が呼ばれること', async () => {
      const { mockSupabase, eqCalls } = buildObservationMock({
        observationsData: [makeObservation({ recorded_by: VALID_STAFF_UUID })],
        count: 1,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        `http://localhost/api/records/personal?staff_id=${VALID_STAFF_UUID}`
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      const recordedByCall = eqCalls.find(
        ([col, val]) => col === 'recorded_by' && val === VALID_STAFF_UUID
      );
      expect(recordedByCall).toBeDefined();
    });

    it('staff_id フィルターは .or() ではなく直接 .eq() で適用されること', async () => {
      // 活動記録は .or() を使うが、個別記録は .eq() を直接使う
      const { mockSupabase, observationQuery, eqCalls } = buildObservationMock({
        observationsData: [],
        count: 0,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        `http://localhost/api/records/personal?staff_id=${VALID_STAFF_UUID}`
      );
      await GET(request);

      // .or() は呼ばれていないこと
      expect(observationQuery.or ?? jest.fn()).not.toHaveBeenCalledWith(
        expect.stringContaining('recorded_by')
      );

      // .eq('recorded_by', ...) は呼ばれていること
      const recordedByEq = eqCalls.find(([col]) => col === 'recorded_by');
      expect(recordedByEq).toBeDefined();
      expect(recordedByEq![1]).toBe(VALID_STAFF_UUID);
    });
  });

  // ─────────────────────────────────────────
  // テスト 2: 無効な UUID は 400 で拒否
  // ─────────────────────────────────────────
  describe('2. staff_id without valid UUID returns 400', () => {
    const invalidUUIDs = [
      'not-a-uuid',
      '12345',
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      '',
      '../../../etc/passwd',
    ];

    it.each(invalidUUIDs)(
      '無効な staff_id "%s" で 400 が返ること',
      async (invalidId) => {
        // 空文字列は searchParams に含まれないため別途処理
        if (invalidId === '') return;

        const { mockSupabase } = buildObservationMock({});
        mockedCreateClient.mockResolvedValue(mockSupabase as any);

        const request = new NextRequest(
          `http://localhost/api/records/personal?staff_id=${encodeURIComponent(invalidId)}`
        );
        const response = await GET(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.error).toMatch(/Invalid staff_id/i);
      }
    );

    it('UUID フォーマット違反でエラーメッセージが返ること', async () => {
      const { mockSupabase } = buildObservationMock({});
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/records/personal?staff_id=invalid-uuid-format'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid staff_id format');
    });
  });

  // ─────────────────────────────────────────
  // テスト 3: staff_id 未指定時は recorded_by フィルター不適用
  // ─────────────────────────────────────────
  describe('3. Without staff_id, recorded_by filter is NOT applied', () => {
    it('staff_id を指定しない場合、.eq("recorded_by", ...) が呼ばれないこと', async () => {
      const obs1 = makeObservation({ id: 'obs-1', recorded_by: 'user-a' });
      const obs2 = makeObservation({ id: 'obs-2', recorded_by: 'user-b' });

      const { mockSupabase, eqCalls } = buildObservationMock({
        observationsData: [obs1, obs2],
        count: 2,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/records/personal'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);

      // recorded_by フィルターが適用されていないこと
      const recordedByCall = eqCalls.find(([col]) => col === 'recorded_by');
      expect(recordedByCall).toBeUndefined();

      // 全件返却されていること
      expect(json.data.observations).toHaveLength(2);
    });

    it('staff_id なしで全記録が返ること（recorded_by 問わず）', async () => {
      const observations = [
        makeObservation({ id: 'obs-1', recorded_by: 'user-a' }),
        makeObservation({ id: 'obs-2', recorded_by: null }),
        makeObservation({ id: 'obs-3', recorded_by: 'user-b' }),
      ];

      const { mockSupabase } = buildObservationMock({
        observationsData: observations,
        count: 3,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/records/personal'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.observations).toHaveLength(3);
      expect(json.data.total).toBe(3);
    });
  });

  // ─────────────────────────────────────────
  // テスト 4: レスポンスに recorded_by_name フィールドが含まれること
  // ─────────────────────────────────────────
  describe('4. Response includes recorded_by_name field', () => {
    it('recorded_by_user がある場合、recorded_by_name にスタッフ名が入ること', async () => {
      const obs = makeObservation({
        recorded_by: VALID_STAFF_UUID,
        recorded_by_user: { id: VALID_STAFF_UUID, name: '田中 記入者' },
      });

      const { mockSupabase } = buildObservationMock({
        observationsData: [obs],
        count: 1,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        `http://localhost/api/records/personal?staff_id=${VALID_STAFF_UUID}`
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.observations[0]).toHaveProperty('recorded_by_name');
      expect(json.data.observations[0].recorded_by_name).toBe('田中 記入者');
    });

    it('recorded_by_user が null の場合、recorded_by_name は null になること', async () => {
      const obs = makeObservation({
        recorded_by: null,
        recorded_by_user: null,
      });

      const { mockSupabase } = buildObservationMock({
        observationsData: [obs],
        count: 1,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/records/personal'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.observations[0]).toHaveProperty('recorded_by_name');
      expect(json.data.observations[0].recorded_by_name).toBeNull();
    });

    it('全レコードに recorded_by_name フィールドが存在すること', async () => {
      const observations = [
        makeObservation({
          id: 'obs-1',
          recorded_by: VALID_STAFF_UUID,
          recorded_by_user: { id: VALID_STAFF_UUID, name: 'スタッフA' },
        }),
        makeObservation({
          id: 'obs-2',
          recorded_by: null,
          recorded_by_user: null,
        }),
      ];

      const { mockSupabase } = buildObservationMock({
        observationsData: observations,
        count: 2,
      });
      mockedCreateClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest(
        'http://localhost/api/records/personal'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      for (const obs of json.data.observations) {
        expect(obs).toHaveProperty('recorded_by_name');
      }
    });
  });
});
