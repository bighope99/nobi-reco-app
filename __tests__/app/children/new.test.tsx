import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChildForm from '@/components/children/ChildForm';

beforeEach(() => {
  global.fetch = jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : input.url;
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
    if (url === '/api/children/save') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { child_id: 'child-1' },
        }),
      } as Response;
    }
    return { ok: false, json: async () => ({ success: false }) } as Response;
  });

  window.alert = jest.fn();
});

describe('ChildForm new', () => {
  it('submits without school selection when school master is empty', async () => {
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
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], {
      target: { value: '2024-04-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: '登録する' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/children/save',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  it('sends the entered payload when saving a new child', async () => {
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
    fireEvent.change(screen.getByPlaceholderText('佐藤 太郎'), {
      target: { value: '山田 太郎' },
    });
    fireEvent.change(screen.getByPlaceholderText('090-0000-0000'), {
      target: { value: '090-1234-5678' },
    });
    fireEvent.change(screen.getByPlaceholderText('example@email.com'), {
      target: { value: 'taro@example.com' },
    });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], {
      target: { value: '2024-04-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: '登録する' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/children/save',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    const saveCall = (global.fetch as jest.Mock).mock.calls.find(
      (call) => call[0] === '/api/children/save',
    );
    const requestBody = JSON.parse(saveCall[1].body);

    expect(requestBody.basic_info).toEqual(
      expect.objectContaining({
        family_name: '山田',
        given_name: '花子',
        birth_date: '2020-04-10',
      }),
    );
    expect(requestBody.contact).toEqual(
      expect.objectContaining({
        parent_name: '山田 太郎',
        parent_phone: '090-1234-5678',
        parent_email: 'taro@example.com',
      }),
    );
  });
});
