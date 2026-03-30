import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import ChildForm from '@/components/children/ChildForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

/**
 * 兄弟候補フィルタリングのテスト
 * - 既に登録済みの兄弟は候補から除外される
 * - 未登録の兄弟のみ候補として表示される
 */

const CLASSES_URL = '/api/children/classes';
const SCHOOLS_URL = '/api/schools';
const SEARCH_SIBLINGS_URL = '/api/children/search-siblings';
const LINK_SIBLING_URL = '/api/children/link-sibling';
const CHILD_URL_PREFIX = '/api/children/';

// 編集モードで既存児童データを返すモック
const mockExistingChild = {
  success: true,
  data: {
    child_id: 'child-1',
    basic_info: {
      family_name: '山田',
      given_name: '太郎',
      family_name_kana: 'ヤマダ',
      given_name_kana: 'タロウ',
      gender: 'male',
      birth_date: '2018-04-01',
      school_id: null,
      grade_add: 0,
      nickname: null,
    },
    affiliation: {
      enrollment_status: 'enrolled',
      enrollment_type: 'regular',
      enrolled_at: '2024-04-01',
      withdrawn_at: null,
      class_id: null,
    },
    contact: {
      parent_name: '山田 一郎',
      parent_phone: '09012345678',
      parent_email: '',
      emergency_contacts: [],
    },
    care_info: { allergies: null, child_characteristics: null, parent_characteristics: null },
    permissions: { photo_permission_public: true, photo_permission_share: true },
    siblings: [
      { child_id: 'sibling-already-registered', name: '山田 花子', relationship: '兄弟' },
    ],
  },
};

describe('ChildForm sibling search filtering', () => {
  beforeEach(() => {
    window.alert = jest.fn();
  });

  it('既に兄弟登録済みの児童は候補として表示されない', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      if (url === CLASSES_URL) {
        return { ok: true, json: async () => ({ success: true, data: { classes: [] } }) } as Response;
      }
      if (url === SCHOOLS_URL) {
        return { ok: true, json: async () => ({ success: true, data: { schools: [] } }) } as Response;
      }
      if (url.startsWith(CHILD_URL_PREFIX)) {
        return { ok: true, json: async () => mockExistingChild } as Response;
      }
      if (url === SEARCH_SIBLINGS_URL) {
        // 検索APIは既登録の兄弟と未登録の兄弟の両方を返す
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              found: true,
              candidates: [
                {
                  child_id: 'sibling-already-registered', // 既に登録済み
                  name: '山田 花子',
                  kana: 'ヤマダ ハナコ',
                  class_name: 'ひまわり組',
                  age: 7,
                  enrollment_status: 'enrolled',
                  photo_url: null,
                },
                {
                  child_id: 'sibling-not-registered', // 未登録
                  name: '山田 次郎',
                  kana: 'ヤマダ ジロウ',
                  class_name: 'さくら組',
                  age: 5,
                  enrollment_status: 'enrolled',
                  photo_url: null,
                },
              ],
              total_found: 2,
            },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({ success: false }) } as Response;
    });

    render(<ChildForm mode="edit" childId="child-1" />);

    // データ読み込み完了を待つ
    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // 兄弟検索をトリガー（電話番号変更でデバウンス後に自動検索される）
    // 検索結果として「山田 次郎」（未登録）が表示される
    await waitFor(() => {
      expect(screen.queryByText('山田 花子')).not.toBeInTheDocument(); // 既登録は表示されない
    }, { timeout: 2000 });
  });

  it('全候補が登録済みの場合は兄弟候補を表示しない', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      if (url === CLASSES_URL) {
        return { ok: true, json: async () => ({ success: true, data: { classes: [] } }) } as Response;
      }
      if (url === SCHOOLS_URL) {
        return { ok: true, json: async () => ({ success: true, data: { schools: [] } }) } as Response;
      }
      if (url.startsWith(CHILD_URL_PREFIX)) {
        return { ok: true, json: async () => mockExistingChild } as Response;
      }
      if (url === SEARCH_SIBLINGS_URL) {
        // 全員が既登録
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              found: true,
              candidates: [
                {
                  child_id: 'sibling-already-registered',
                  name: '山田 花子',
                  kana: 'ヤマダ ハナコ',
                  class_name: 'ひまわり組',
                  age: 7,
                  enrollment_status: 'enrolled',
                  photo_url: null,
                },
              ],
              total_found: 1,
            },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({ success: false }) } as Response;
    });

    render(<ChildForm mode="edit" childId="child-1" />);

    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // 全候補が登録済みなので「兄弟候補が見つかりました」は表示されない
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(screen.queryByText('兄弟候補が見つかりました')).not.toBeInTheDocument();
  });

  it('新規モードでも紐付けるを押すと保存待ちの兄弟としてUIに反映され、保存時に sibling_ids を送る', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      if (url === CLASSES_URL) {
        return { ok: true, json: async () => ({ success: true, data: { classes: [] } }) } as Response;
      }
      if (url === SCHOOLS_URL) {
        return { ok: true, json: async () => ({ success: true, data: { schools: [] } }) } as Response;
      }
      if (url === SEARCH_SIBLINGS_URL) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              found: true,
              candidates: [
                {
                  child_id: 'sibling-pending-1',
                  name: '山田 次郎',
                  kana: 'ヤマダ ジロウ',
                  class_name: 'さくら組',
                  age: 5,
                  enrollment_status: 'enrolled',
                  photo_url: null,
                  guardian_contacts: [
                    {
                      guardian_id: 'guardian-1',
                      name: '山田 一郎',
                      kana: 'ヤマダ イチロウ',
                      phone: '09012345678',
                      relation: '父',
                      is_primary: true,
                    },
                  ],
                },
              ],
              total_found: 1,
            },
          }),
        } as Response;
      }
      if (url === '/api/children/save') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { child_id: 'child-new-1' },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({ success: false }) } as Response;
    });

    render(<ChildForm mode="new" />);

    fireEvent.change(screen.getByPlaceholderText('姓'), {
      target: { value: '山田' },
    });
    fireEvent.change(screen.getByPlaceholderText('名'), {
      target: { value: '花子' },
    });
    fireEvent.change(screen.getByPlaceholderText('年'), {
      target: { value: '2020' },
    });
    fireEvent.change(screen.getByPlaceholderText('月'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByPlaceholderText('日'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByPlaceholderText('090-0000-0000'), {
      target: { value: '090-1234-5678' },
    });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], {
      target: { value: '2024-04-01' },
    });

    fireEvent.blur(screen.getByPlaceholderText('090-0000-0000'));

    await waitFor(() => {
      expect(screen.getByText('兄弟候補が見つかりました')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '紐付ける' }));

    await waitFor(() => {
      expect(screen.getByText('紐付け済みの兄弟・姉妹')).toBeInTheDocument();
      expect(screen.getByText('山田 次郎')).toBeInTheDocument();
      expect(screen.getByDisplayValue('山田 一郎')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ヤマダ イチロウ')).toBeInTheDocument();
      expect(screen.getByDisplayValue('父')).toBeInTheDocument();
      expect(screen.getByDisplayValue('09012345678')).toBeInTheDocument();
    });

    expect(screen.queryAllByPlaceholderText('氏名')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '登録する' }));

    await waitFor(() => {
      const saveCall = (global.fetch as jest.Mock).mock.calls.find(
        (call) => call[0] === '/api/children/save',
      );
      expect(saveCall).toBeTruthy();
      const requestBody = JSON.parse(saveCall[1].body);
      expect(requestBody.sibling_ids).toEqual(['sibling-pending-1']);
      expect(requestBody.contact.parent_name).toBe('山田 一郎');
      expect(requestBody.contact.parent_kana).toBe('ヤマダ イチロウ');
      expect(requestBody.contact.parent_relation).toBe('父');
      expect(requestBody.contact.parent_phone).toBe('09012345678');
      expect(requestBody.contact.emergency_contacts).toEqual([]);
    });
  });

  it('編集モードで兄弟を紐付けると兄弟側の筆頭保護者が筆頭欄に表示される', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

      if (url === CLASSES_URL) {
        return { ok: true, json: async () => ({ success: true, data: { classes: [] } }) } as Response;
      }
      if (url === SCHOOLS_URL) {
        return { ok: true, json: async () => ({ success: true, data: { schools: [] } }) } as Response;
      }
      if (url === SEARCH_SIBLINGS_URL) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              found: true,
              candidates: [
                {
                  child_id: 'sibling-edit-1',
                  name: '山田 次郎',
                  kana: 'ヤマダ ジロウ',
                  class_name: 'さくら組',
                  age: 5,
                  enrollment_status: 'enrolled',
                  photo_url: null,
                  guardian_contacts: [
                    {
                      guardian_id: 'guardian-primary-1',
                      name: '山田 花子',
                      kana: 'ヤマダ ハナコ',
                      phone: '08011112222',
                      relation: '母',
                      is_primary: true,
                    },
                    {
                      guardian_id: 'guardian-secondary-1',
                      name: '山田 三郎',
                      kana: 'ヤマダ サブロウ',
                      phone: '08033334444',
                      relation: '祖父',
                      is_primary: false,
                    },
                  ],
                },
              ],
              total_found: 1,
            },
          }),
        } as Response;
      }
      if (url.startsWith(CHILD_URL_PREFIX)) {
        return { ok: true, json: async () => mockExistingChild } as Response;
      }
      if (url === LINK_SIBLING_URL) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { sibling_name: '山田 次郎' },
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({ success: false }) } as Response;
    });

    render(<ChildForm mode="edit" childId="child-1" />);

    await waitFor(() => {
      expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.blur(screen.getByPlaceholderText('090-0000-0000'));

    await waitFor(() => {
      expect(screen.getByText('兄弟候補が見つかりました')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '紐付ける' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('山田 花子')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ヤマダ ハナコ')).toBeInTheDocument();
      expect(screen.getByDisplayValue('母')).toBeInTheDocument();
      expect(screen.getByDisplayValue('08011112222')).toBeInTheDocument();
      expect(screen.getByText('山田 次郎')).toBeInTheDocument();
      expect(screen.getByDisplayValue('山田 三郎')).toBeInTheDocument();
    });

    expect(screen.queryByDisplayValue('山田 一郎')).not.toBeInTheDocument();
  });
});
