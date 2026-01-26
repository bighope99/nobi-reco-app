import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChildForm from '@/components/children/ChildForm';

beforeEach(() => {
  global.fetch = jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
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
  it('displays add button when less than 2 contacts', async () => {
    render(<ChildForm mode="new" />);

    // 初期状態で「追加する」ボタンが表示される
    expect(screen.getByText('追加する')).toBeInTheDocument();
  });

  it('hides add button after adding second contact', async () => {
    render(<ChildForm mode="new" />);

    // 「追加する」ボタンをクリック
    const addButton = screen.getByText('追加する');
    fireEvent.click(addButton);

    // 2件になったらボタンが非表示になる
    await waitFor(() => {
      expect(screen.queryByText('追加する')).not.toBeInTheDocument();
    });
  });

  it('shows correct number of emergency contact fields', async () => {
    render(<ChildForm mode="new" />);

    // 初期状態: 1件の入力フィールド（緊急連絡先）
    const relationInputs = screen.getAllByPlaceholderText('続柄');
    expect(relationInputs).toHaveLength(1);

    // 追加後: 2件の入力フィールド
    fireEvent.click(screen.getByText('追加する'));

    await waitFor(() => {
      const updatedRelationInputs = screen.getAllByPlaceholderText('続柄');
      expect(updatedRelationInputs).toHaveLength(2);
    });
  });
});
