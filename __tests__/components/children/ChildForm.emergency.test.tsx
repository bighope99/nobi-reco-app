import { render, screen } from '@testing-library/react';
import ChildForm from '@/components/children/ChildForm';

beforeEach(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString();
    if (url === '/api/children/classes') {
      return { ok: true, json: async () => ({ success: true, data: { classes: [] } }) } as Response;
    }
    if (url === '/api/schools') {
      return { ok: true, json: async () => ({ success: true, data: { schools: [] } }) } as Response;
    }
    return { ok: false, json: async () => ({ success: false }) } as Response;
  });
  window.alert = jest.fn();
});

describe('ChildForm emergency contacts', () => {
  it('displays add button when less than 5 contacts', async () => {
    render(<ChildForm mode="new" />);

    // 初期状態で「追加する」ボタンが表示される
    expect(screen.getByText('追加する')).toBeInTheDocument();
  });

  it('disables add button when parent name is not filled', async () => {
    render(<ChildForm mode="new" />);

    // 筆頭保護者名が未入力のときは追加ボタンが disabled になる
    const addButton = screen.getByText('追加する');
    expect(addButton).toBeDisabled();
  });

  it('shows no guardian contact fields initially', async () => {
    render(<ChildForm mode="new" />);

    // 初期状態: 保護者連絡先リストは空（0件）
    const relationInputs = screen.queryAllByPlaceholderText('続柄（例: 母、叔母など）');
    expect(relationInputs).toHaveLength(0);
  });
});
