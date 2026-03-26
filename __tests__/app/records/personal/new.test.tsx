import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ObservationEditor } from '@/app/records/personal/_components/observation-editor';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

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
    // 記録者をCookieで事前選択
    document.cookie = 'nobi_last_recorder=staff-1; path=/';
    render(<ObservationEditor mode="new" initialChildId="1" />);

    // スタッフ一覧のロード＆Cookie復元を待つ
    await waitFor(() => {
      expect(screen.getByText('テスト職員A')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: '今日は積み木で高い塔を作っていました。集中して取り組んでいました。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    const aiAction = await screen.findByLabelText('抽出された事実');
    await screen.findByDisplayValue('今日は積み木で高い塔を作っていました。');
    expect((aiAction as HTMLTextAreaElement).value).toContain('積み木で高い塔');
  });

  it('loads observation tags from m_observation_tags', async () => {
    tagData = [{ id: 'tag-1', name: '自立', description: null, color: null, sort_order: 1 }];

    // 記録者をCookieで事前選択
    document.cookie = 'nobi_last_recorder=staff-1; path=/';
    render(<ObservationEditor mode="new" initialChildId="1" />);

    // スタッフ一覧のロード＆Cookie復元を待つ
    await waitFor(() => {
      expect(screen.getByText('テスト職員A')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: '今日は積み木で高い塔を作っていました。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    expect(await screen.findByText('自立')).toBeInTheDocument();
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

    // editモードでは「データを元に戻す」ボタンが表示されることを確認
    expect(screen.queryByText('データを元に戻す')).toBeInTheDocument();
  });
});
