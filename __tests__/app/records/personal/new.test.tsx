import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ObservationEditor } from '@/app/records/personal/_components/observation-editor';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

// @/components/ui/select を JSDOM 環境で動作するネイティブ <select> に置き換える。
// Radix UI Select は JSDOM ではポータルが機能しないため、
// Select/SelectTrigger/SelectContent/SelectItem を native <select>/<option> にマッピングする。
jest.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{ onValueChange?: (v: string) => void; value?: string }>({});

  const Select = ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode }) =>
    React.createElement(SelectContext.Provider, { value: { onValueChange, value } }, children);

  const SelectTrigger = ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement('div', { role: 'combobox', className }, children);

  const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const ctx = React.useContext(SelectContext);
    return React.createElement('span', { 'data-testid': 'select-value' }, ctx.value || placeholder);
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'select-content' }, children);

  const SelectItem = ({ value: itemValue, children }: { value?: string; children?: React.ReactNode }) => {
    const ctx = React.useContext(SelectContext);
    return React.createElement('div', {
      role: 'option',
      'data-value': itemValue,
      onClick: () => ctx.onValueChange?.(itemValue ?? ''),
    }, children);
  };

  const SelectGroup = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', {}, children);
  const SelectLabel = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', {}, children);
  const SelectSeparator = () => React.createElement('hr', {});
  const SelectScrollUpButton = () => null;
  const SelectScrollDownButton = () => null;

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton };
});

let tagData: Array<{ id: string; name: string; description: string | null; color: string | null; sort_order: number }> = [];

const staffData = [
  { user_id: 'staff-1', name: 'テスト職員A' },
  { user_id: 'staff-2', name: 'テスト職員B' },
];

beforeEach(() => {
  tagData = [];
  global.fetch = jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url === '/api/records/personal/tags') {
      return {
        ok: true,
        json: async () => ({ success: true, data: tagData }),
      } as unknown as Response;
    }
    if (url === '/api/children?status=enrolled&sort_by=name&sort_order=asc&limit=200') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            children: [
              {
                child_id: '1',
                name: 'テスト児童',
                class_name: 'さくら組',
              },
            ],
          },
        }),
      } as unknown as Response;
    }
    if (url.startsWith('/api/records/personal/child/')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { recent_observations: [] },
        }),
      } as unknown as Response;
    }
    if (url === '/api/records/personal/ai') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            objective: '今日は積み木で高い塔を作っていました。',
            subjective: '',
            flags: {},
          },
        }),
      } as unknown as Response;
    }
    if (url === '/api/records/personal') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'obs-1',
            observation_date: '2025-01-03',
            content: '今日は積み木で高い塔を作っていました。集中して取り組んでいました。',
          },
        }),
      } as unknown as Response;
    }
    if (url === '/api/users?is_active=true') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { users: staffData },
        }),
      } as unknown as Response;
    }
    return { ok: false, json: async () => ({ success: false, error: 'not found' }) } as unknown as Response;
  });
});

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = ResizeObserverMock;
});

describe('ObservationEditor new', () => {
  it('saves a new record and auto-fills AI analysis', async () => {
    // スタッフAPIを失敗させ、staffLoadError=true にすることで記録者選択なしで保存フローをテストする
    global.fetch = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === '/api/records/personal/tags') {
        return { ok: true, json: async () => ({ success: true, data: tagData }) } as unknown as Response;
      }
      if (url === '/api/children?status=enrolled&sort_by=name&sort_order=asc&limit=200') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { children: [{ child_id: '1', name: 'テスト児童', class_name: 'さくら組' }] } }),
        } as unknown as Response;
      }
      if (url.startsWith('/api/records/personal/child/')) {
        return { ok: true, json: async () => ({ success: true, data: { recent_observations: [] } }) } as unknown as Response;
      }
      if (url === '/api/records/personal/ai') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { objective: '今日は積み木で高い塔を作っていました。', subjective: '', flags: {} } }),
        } as unknown as Response;
      }
      if (url === '/api/records/personal') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'obs-1', observation_date: '2025-01-03', content: '今日は積み木で高い塔を作っていました。集中して取り組んでいました。' },
          }),
        } as unknown as Response;
      }
      // スタッフAPIは失敗させて staffLoadError=true にする
      if (url === '/api/users?is_active=true') {
        return { ok: false, json: async () => ({ success: false, error: 'error' }) } as unknown as Response;
      }
      return { ok: false, json: async () => ({ success: false, error: 'not found' }) } as unknown as Response;
    });

    render(<ObservationEditor mode="new" initialChildId="1" />);

    // スタッフ取得失敗エラーメッセージが表示されるまで待つ
    await waitFor(() => {
      expect(screen.getByText('記録者情報の取得に失敗しました')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: '今日は積み木で高い塔を作っていました。集中して取り組んでいました。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    // 保存後、AI解析結果が読み取り専用表示で確認できる（テキストエリアではなくdivに表示）
    await screen.findByText(/積み木で高い塔/, { exact: false });
  });

  it('loads observation tags from m_observation_tags', async () => {
    tagData = [{ id: 'tag-1', name: '自立', description: null, color: null, sort_order: 1 }];

    // スタッフAPIを失敗させ、staffLoadError=true にすることで記録者選択なしで保存フローをテストする
    global.fetch = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === '/api/records/personal/tags') {
        return { ok: true, json: async () => ({ success: true, data: tagData }) } as unknown as Response;
      }
      if (url === '/api/children?status=enrolled&sort_by=name&sort_order=asc&limit=200') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { children: [{ child_id: '1', name: 'テスト児童', class_name: 'さくら組' }] } }),
        } as unknown as Response;
      }
      if (url.startsWith('/api/records/personal/child/')) {
        return { ok: true, json: async () => ({ success: true, data: { recent_observations: [] } }) } as unknown as Response;
      }
      if (url === '/api/records/personal/ai') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { objective: '今日は積み木で高い塔を作っていました。', subjective: '', flags: { '自立': true } } }),
        } as unknown as Response;
      }
      if (url === '/api/records/personal') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'obs-1', observation_date: '2025-01-03', content: '今日は積み木で高い塔を作っていました。' },
          }),
        } as unknown as Response;
      }
      // スタッフAPIは失敗させて staffLoadError=true にする
      if (url === '/api/users?is_active=true') {
        return { ok: false, json: async () => ({ success: false, error: 'error' }) } as unknown as Response;
      }
      return { ok: false, json: async () => ({ success: false, error: 'not found' }) } as unknown as Response;
    });

    render(<ObservationEditor mode="new" initialChildId="1" />);

    // スタッフ取得失敗エラーメッセージが表示されるまで待つ
    await waitFor(() => {
      expect(screen.getByText('記録者情報の取得に失敗しました')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: '今日は積み木で高い塔を作っていました。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    expect(await screen.findByText('自立')).toBeInTheDocument();
  });

  it('スタッフAPI成功時に記録者が未選択のままで保存するとエラーになり、選択後は保存できる', async () => {
    // beforeEach の global.fetch はスタッフAPIが成功するよう設定済み
    render(<ObservationEditor mode="new" initialChildId="child-1" />);

    // スタッフ一覧のロードを待つ（記録者Selectが表示されるまで）
    await waitFor(() => {
      const selectTriggers = screen.getAllByRole('combobox');
      expect(selectTriggers.length).toBeGreaterThanOrEqual(2);
    });

    // 記録者が未選択（デフォルト）であることを確認
    // SelectTrigger に placeholder が表示されていることを確認
    expect(screen.getByText('記録者を選択')).toBeInTheDocument();

    // 本文を入力して記録者未選択のまま保存しようとする
    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: 'テスト観察本文です。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    // 記録者未選択バリデーションエラーが表示されることを確認
    expect(await screen.findByText('記録者を選択してください')).toBeInTheDocument();

    // モックの SelectContent 内に SelectItem が常に表示されているため、
    // テスト職員A の option を直接クリックして記録者を選択する
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'テスト職員A' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option', { name: 'テスト職員A' }));

    // 記録者が選択されたことを確認（SelectValue に staff-1 の値が反映される）
    await waitFor(() => {
      // placeholder が消えて選択した職員名が表示されるか、
      // または「記録者を選択してください」エラーなしで保存できることで確認する
      expect(screen.queryByText('記録者を選択')).not.toBeInTheDocument();
    });

    // 保存する
    fireEvent.click(screen.getByTestId('observation-save'));

    // 保存成功後、AI解析結果が表示される
    await screen.findByText(/積み木で高い塔/, { exact: false });
  });

  it('記録者未選択で保存しようとするとエラーを表示する', async () => {
    // Cookieをクリアして記録者未選択状態にする
    document.cookie = 'nobi_last_recorder=; path=/; max-age=0';
    render(<ObservationEditor mode="new" initialChildId="1" />);

    // スタッフ一覧のロードを待つ（記録者Selectが表示されるまで）
    await waitFor(() => {
      const selectTriggers = screen.getAllByRole('combobox');
      // 記録者Select（2番目以降のcombobox）が表示されていることを確認
      expect(selectTriggers.length).toBeGreaterThanOrEqual(2);
    });

    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: '今日は積み木で高い塔を作っていました。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    // 記録者未選択エラーが表示されることを確認
    expect(await screen.findByText('記録者を選択してください')).toBeInTheDocument();
  });
});

describe('ObservationEditor edit', () => {
  it('「データを元に戻す」ボタンが表示されない', async () => {
    // 編集モード用のfetchモックを追加
    global.fetch = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === '/api/records/personal/tags') {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as unknown as Response;
      }
      if (url === '/api/children?status=enrolled&sort_by=name&sort_order=asc&limit=200') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { children: [] },
          }),
        } as unknown as Response;
      }
      if (url === '/api/records/personal/obs-edit-1') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'obs-edit-1',
              child_id: 'child-1',
              child_name: 'テスト児童',
              observation_date: '2025-01-03',
              content: 'テスト本文',
              objective: '',
              subjective: '',
              tag_flags: {},
              created_by: 'user-1',
              created_by_name: 'テスト職員',
              created_at: '2025-01-03T10:00:00Z',
              updated_at: '2025-01-03T10:00:00Z',
              recorded_by: 'staff-1',
              recorded_by_name: 'テスト職員A',
              recent_observations: [],
            },
          }),
        } as unknown as Response;
      }
      if (url === '/api/users?is_active=true') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { users: staffData },
          }),
        } as unknown as Response;
      }
      return { ok: false, json: async () => ({ success: false, error: 'not found' }) } as unknown as Response;
    });

    render(<ObservationEditor mode="edit" observationId="obs-edit-1" />);

    // 編集画面のロードを待つ
    await waitFor(() => {
      expect(screen.getByText('テスト本文')).toBeInTheDocument();
    });

    // editモードでは「データを元に戻す」ボタンが表示されないことを確認
    expect(screen.queryByText('データを元に戻す')).not.toBeInTheDocument();
  });
});
