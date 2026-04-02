import { render, screen, waitFor } from '@testing-library/react';
import ChildForm from '@/components/children/ChildForm';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('ChildForm class selection visibility', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hides class selection when facility has no classes', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === '/api/children/classes') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { classes: [] } }),
        } as Response;
      }
      if (url === '/api/schools') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { schools: [] } }),
        } as Response;
      }
      return { ok: false, json: async () => ({ success: false }) } as Response;
    });

    render(<ChildForm mode="new" />);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/children/classes');
    });

    // Class selection should not be displayed
    expect(screen.queryByText('現在のクラス')).not.toBeInTheDocument();
    expect(screen.queryByText('クラスを選択...')).not.toBeInTheDocument();
  });

  it('shows class selection when facility has classes', async () => {
    global.fetch = jest.fn(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === '/api/children/classes') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              classes: [
                { class_id: 'cls-1', class_name: 'ひまわり組' },
                { class_id: 'cls-2', class_name: 'さくら組' },
              ],
            },
          }),
        } as Response;
      }
      if (url === '/api/schools') {
        return {
          ok: true,
          json: async () => ({ success: true, data: { schools: [] } }),
        } as Response;
      }
      return { ok: false, json: async () => ({ success: false }) } as Response;
    });

    render(<ChildForm mode="new" />);

    // Wait for classes to load and display
    await waitFor(() => {
      expect(screen.getByText('現在のクラス')).toBeInTheDocument();
    });

    expect(screen.getByText('クラスを選択...')).toBeInTheDocument();
    expect(screen.getByText('ひまわり組')).toBeInTheDocument();
    expect(screen.getByText('さくら組')).toBeInTheDocument();
  });

  it('does not show class selection while loading', () => {
    // Mock fetch that never resolves (simulates loading)
    global.fetch = jest.fn(() => new Promise(() => {}));

    render(<ChildForm mode="new" />);

    // During loading, class selection should not be visible
    expect(screen.queryByText('現在のクラス')).not.toBeInTheDocument();
  });
});
