import { fireEvent, render, screen } from '@testing-library/react';
import { ObservationEditor } from '@/app/records/personal/_components/observation-editor';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

let tagData: Array<{ id: string; name: string; description: string | null; color: string | null; sort_order: number }> = [];

beforeEach(() => {
  tagData = [];
  global.fetch = jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
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
    render(<ObservationEditor mode="new" initialChildId="1" />);

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

    render(<ObservationEditor mode="new" initialChildId="1" />);

    fireEvent.change(screen.getByLabelText('本文'), {
      target: { value: '今日は積み木で高い塔を作っていました。' },
    });

    fireEvent.click(screen.getByTestId('observation-save'));

    expect(await screen.findByText('自立')).toBeInTheDocument();
  });
});
