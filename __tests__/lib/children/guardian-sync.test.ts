/**
 * @jest-environment node
 */
import { syncGuardiansToSiblings, syncGuardiansBidirectional } from '@/lib/children/guardian-sync';

// ---------------------------------------------------------------------------
// Supabase チェーンモックビルダー
//
// guardian-sync.ts が実行するクエリシーケンス:
//   1. _child_sibling  : .select('sibling_id').eq('child_id', childId)
//   2. m_children      : .select('id').in('id', siblingIds).eq('facility_id', facilityId).is('deleted_at', null)
//   3. _child_guardian : .select('guardian_id, relationship, is_emergency_contact').eq('child_id', childId)
//   4. _child_guardian : .select('child_id, guardian_id').in('child_id', validSiblingIds)
//   5. _child_guardian : .upsert(newLinks, { onConflict: ..., ignoreDuplicates: true })
// ---------------------------------------------------------------------------

interface CreateSupabaseMockOptions {
  siblingLinksData?: Array<{ sibling_id: string }> | null;
  siblingLinksError?: { message: string } | null;
  validSiblingsData?: Array<{ id: string }> | null;
  validSiblingsError?: { message: string } | null;
  childGuardiansData?: Array<{
    guardian_id: string;
    relationship: string;
    is_emergency_contact: boolean;
  }> | null;
  childGuardiansError?: { message: string } | null;
  existingLinksData?: Array<{ child_id: string; guardian_id: string }> | null;
  existingLinksError?: { message: string } | null;
  upsertError?: { message: string } | null;
}

const createSupabaseMock = (options: CreateSupabaseMockOptions = {}) => {
  const {
    siblingLinksData = [],
    siblingLinksError = null,
    validSiblingsData = [],
    validSiblingsError = null,
    childGuardiansData = [],
    childGuardiansError = null,
    existingLinksData = [],
    existingLinksError = null,
    upsertError = null,
  } = options;

  // _child_guardian は2回 from が呼ばれる:
  //   1回目: .select('guardian_id, relationship, is_emergency_contact').eq('child_id', childId)
  //   2回目: .select('child_id, guardian_id').in('child_id', validSiblingIds)
  // from が呼ばれるたびに呼び出し回数をカウントして分岐する。
  let childGuardianFromCount = 0;

  const upsertMockFn = jest.fn().mockResolvedValue({ error: upsertError });

  return {
    from: jest.fn((table: string) => {
      if (table === '_child_sibling') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: siblingLinksData,
              error: siblingLinksError,
            }),
          }),
        };
      }

      if (table === 'm_children') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockResolvedValue({
                  data: validSiblingsData,
                  error: validSiblingsError,
                }),
              }),
            }),
          }),
        };
      }

      if (table === '_child_guardian') {
        childGuardianFromCount += 1;
        const callIndex = childGuardianFromCount;

        if (callIndex === 1) {
          // 1回目: .select(...).eq('child_id', childId) → 子どもの保護者取得
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: childGuardiansData,
                error: childGuardiansError,
              }),
            }),
            upsert: upsertMockFn,
          };
        }

        if (callIndex === 2) {
          // 2回目: .select(...).in('child_id', validSiblingIds) → 既存リンク取得
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: existingLinksData,
                error: existingLinksError,
              }),
            }),
            upsert: upsertMockFn,
          };
        }

        // 3回目: upsert 呼び出し用（.from('_child_guardian').upsert(...)）
        return { upsert: upsertMockFn };
      }

      return {};
    }),
    _upsertMock: upsertMockFn,
  };
};

// ---------------------------------------------------------------------------
// syncGuardiansToSiblings
// ---------------------------------------------------------------------------

describe('syncGuardiansToSiblings', () => {
  const CHILD_ID = 'child-a';
  const FACILITY_ID = 'facility-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('早期リターン', () => {
    it('兄弟なし → DBアクセスが _child_sibling の1回のみで終了する', async () => {
      const supabase = createSupabaseMock({ siblingLinksData: [] });
      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      // _child_sibling は1回 from が呼ばれる
      expect(supabase.from).toHaveBeenCalledWith('_child_sibling');
      // 以降のテーブルへのアクセスはない
      expect(supabase.from).not.toHaveBeenCalledWith('m_children');
      expect(supabase.from).not.toHaveBeenCalledWith('_child_guardian');
    });

    it('siblingLinks が null の場合も早期リターンする', async () => {
      const supabase = createSupabaseMock({ siblingLinksData: null });
      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      expect(supabase.from).not.toHaveBeenCalledWith('m_children');
    });

    it('施設スコープ検証で兄弟が0件 → 保護者取得は行われない', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [], // 施設スコープ外
      });
      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      expect(supabase.from).toHaveBeenCalledWith('_child_sibling');
      expect(supabase.from).toHaveBeenCalledWith('m_children');
      expect(supabase.from).not.toHaveBeenCalledWith('_child_guardian');
    });

    it('validSiblings が null の場合も早期リターンする', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: null,
      });
      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      expect(supabase.from).not.toHaveBeenCalledWith('_child_guardian');
    });

    it('保護者なし → upsert は呼ばれない', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: [], // 保護者なし
      });
      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      const childGuardianMock = supabase.from.mock.results.find(
        (_, i) => supabase.from.mock.calls[i][0] === '_child_guardian'
      );
      // upsert が呼ばれていないことを確認
      if (childGuardianMock) {
        expect(childGuardianMock.value.upsert).not.toHaveBeenCalled();
      }
    });

    it('保護者が null の場合も早期リターンする', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: null,
      });
      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      // from が '_child_guardian' で呼ばれた回数: 1回のみ（保護者取得）
      const calls = supabase.from.mock.calls.filter((c: string[]) => c[0] === '_child_guardian');
      expect(calls).toHaveLength(1);
    });
  });

  describe('upsert 実行', () => {
    it('兄弟あり・既存リンクあり → 重複するので upsert が呼ばれない', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: [
          { guardian_id: 'guardian-1', relationship: '父', is_emergency_contact: true },
        ],
        existingLinksData: [
          // child-b にはすでに guardian-1 が紐付いている
          { child_id: 'child-b', guardian_id: 'guardian-1' },
        ],
      });

      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      // upsert は呼ばれない（newLinks が空になるため）
      expect((supabase as any)._upsertMock).not.toHaveBeenCalled();
    });

    it('兄弟あり・既存リンクなし → 新規 upsert される', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: [
          { guardian_id: 'guardian-1', relationship: '母', is_emergency_contact: false },
        ],
        existingLinksData: [], // 既存リンクなし
      });

      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      expect((supabase as any)._upsertMock).toHaveBeenCalledTimes(1);
      expect((supabase as any)._upsertMock).toHaveBeenCalledWith(
        [
          {
            child_id: 'child-b',
            guardian_id: 'guardian-1',
            relationship: '母',
            is_primary: false,
            is_emergency_contact: false,
          },
        ],
        { onConflict: 'child_id,guardian_id', ignoreDuplicates: true }
      );
    });

    it('全保護者が既存リンク済みの場合 → newLinks が空なので upsert は呼ばれない', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: [
          { guardian_id: 'guardian-1', relationship: '父', is_emergency_contact: true },
        ],
        existingLinksData: [{ child_id: 'child-b', guardian_id: 'guardian-1' }], // 全員既存
      });

      await syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID);

      expect((supabase as any)._upsertMock).not.toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('_child_sibling クエリエラー時 → エラーをthrow する', async () => {
      const supabase = createSupabaseMock({
        siblingLinksError: { message: 'DB connection error' },
      });

      await expect(
        syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID)
      ).rejects.toThrow(`Failed to fetch sibling links for child ${CHILD_ID}: DB connection error`);
    });

    it('施設スコープ検証エラー時 → エラーをthrow する', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsError: { message: 'Validation query failed' },
      });

      await expect(
        syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID)
      ).rejects.toThrow('Failed to validate sibling facility scope: Validation query failed');
    });

    it('_child_guardian 取得エラー時 → エラーをthrow する', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansError: { message: 'Guardian fetch failed' },
      });

      await expect(
        syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID)
      ).rejects.toThrow(`Failed to fetch guardians for child ${CHILD_ID}: Guardian fetch failed`);
    });

    it('既存リンク取得エラー時 → エラーをthrow する', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: [
          { guardian_id: 'guardian-1', relationship: '母', is_emergency_contact: false },
        ],
        existingLinksError: { message: 'Existing links query failed' },
      });

      await expect(
        syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID)
      ).rejects.toThrow('Failed to fetch existing guardian links: Existing links query failed');
    });

    it('upsert エラー時 → エラーをthrow する', async () => {
      const supabase = createSupabaseMock({
        siblingLinksData: [{ sibling_id: 'child-b' }],
        validSiblingsData: [{ id: 'child-b' }],
        childGuardiansData: [
          { guardian_id: 'guardian-1', relationship: '父', is_emergency_contact: true },
        ],
        existingLinksData: [], // 既存リンクなし → upsert が走る
        upsertError: { message: 'Upsert conflict' },
      });

      await expect(
        syncGuardiansToSiblings(supabase as any, CHILD_ID, FACILITY_ID)
      ).rejects.toThrow('Failed to sync guardian links to siblings: Upsert conflict');
    });
  });
});

// ---------------------------------------------------------------------------
// syncGuardiansBidirectional
// ---------------------------------------------------------------------------

describe('syncGuardiansBidirectional', () => {
  const CHILD_ID_A = 'child-a';
  const CHILD_ID_B = 'child-b';
  const FACILITY_ID = 'facility-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('A→B と B→A の両方向で syncGuardiansToSiblings が呼ばれる', async () => {
    // targetSiblingId が渡されるため m_children の .single() パスが使われる
    // validSibling が null を返す → 早期リターンするが呼び出し自体は発生する
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    await syncGuardiansBidirectional(supabase as any, CHILD_ID_A, CHILD_ID_B, FACILITY_ID);

    // m_children への from 呼び出しが2回（A→B用・B→A用）あることを確認
    const mChildrenCalls = supabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'm_children'
    );
    expect(mChildrenCalls).toHaveLength(2);
  });

  it('A が完了してから B が実行される（直列実行）', async () => {
    const executionOrder: string[] = [];

    // targetSiblingId が渡されるため m_children の .single() パスが使われる
    // .eq('id', targetSiblingId) の第2引数（targetSiblingId の値）で実行順を記録する
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((_col: string, val: string) => {
                executionOrder.push(val); // targetSiblingId の値を記録
                return {
                  eq: jest.fn().mockReturnValue({
                    is: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                };
              }),
            }),
          };
        }
        return {};
      }),
    };

    await syncGuardiansBidirectional(supabase as any, CHILD_ID_A, CHILD_ID_B, FACILITY_ID);

    // A→B（targetSiblingId=child-b）が先に実行され、その後 B→A（targetSiblingId=child-a）が実行されること
    expect(executionOrder[0]).toBe(CHILD_ID_B);
    expect(executionOrder[1]).toBe(CHILD_ID_A);
  });

  it('A でエラーが発生した場合、B は実行されない', async () => {
    // targetSiblingId が渡されるため m_children の .single() パスが使われる
    // validSibling を返したあと _child_guardian の取得でエラーを発生させる
    let mChildrenCallCount = 0;
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'm_children') {
          mChildrenCallCount += 1;
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  is: jest.fn().mockReturnValue({
                    single: jest.fn().mockResolvedValue({
                      data: { id: mChildrenCallCount === 1 ? CHILD_ID_B : CHILD_ID_A },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === '_child_guardian') {
          // A の処理中（1回目）にエラーを返す
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'A side error' },
              }),
            }),
          };
        }
        return {};
      }),
    };

    await expect(
      syncGuardiansBidirectional(supabase as any, CHILD_ID_A, CHILD_ID_B, FACILITY_ID)
    ).rejects.toThrow();

    // m_children の from が1回のみ呼ばれている（A で失敗し B は実行されない）
    const mChildrenCalls = supabase.from.mock.calls.filter(
      (c: string[]) => c[0] === 'm_children'
    );
    expect(mChildrenCalls).toHaveLength(1);
  });
});
