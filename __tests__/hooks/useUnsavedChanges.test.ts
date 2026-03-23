import { renderHook } from '@testing-library/react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

describe('useUnsavedChanges', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('registers beforeunload listener when isDirty is true', () => {
    renderHook(() => useUnsavedChanges(true));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('registers beforeunload listener even when isDirty is false', () => {
    renderHook(() => useUnsavedChanges(false));

    const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'beforeunload'
    );
    expect(beforeUnloadCalls).toHaveLength(1);
  });

  it('calls preventDefault on beforeunload event when dirty', () => {
    renderHook(() => useUnsavedChanges(true));

    const handler = addEventListenerSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'beforeunload'
    )?.[1] as ((e: BeforeUnloadEvent) => void) | undefined;

    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    handler!(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not call preventDefault on beforeunload event when not dirty', () => {
    renderHook(() => useUnsavedChanges(false));

    const handler = addEventListenerSpy.mock.calls.find(
      (call: unknown[]) => call[0] === 'beforeunload'
    )?.[1] as ((e: BeforeUnloadEvent) => void) | undefined;

    expect(handler).toBeDefined();

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
    handler!(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('removes beforeunload listener on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChanges(true));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  describe('click capture intercept', () => {
    /**
     * アンカー要素を生成してドキュメントに追加し、クリックイベントをディスパッチするヘルパー
     */
    function createAndClickAnchor(href: string): { event: MouseEvent; preventDefault: jest.Mock; stopPropagation: jest.Mock } {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = 'link';
      document.body.appendChild(anchor);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefault = jest.fn();
      const stopPropagation = jest.fn();
      Object.defineProperty(event, 'preventDefault', { value: preventDefault, writable: true });
      Object.defineProperty(event, 'stopPropagation', { value: stopPropagation, writable: true });

      anchor.dispatchEvent(event);

      document.body.removeChild(anchor);
      return { event, preventDefault, stopPropagation };
    }

    it('prevents navigation when isDirty=true and user cancels confirm', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      renderHook(() => useUnsavedChanges(true));

      const { preventDefault, stopPropagation } = createAndClickAnchor('http://localhost/other-page');

      expect(window.confirm).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
    });

    it('allows navigation when isDirty=true and user confirms', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);

      renderHook(() => useUnsavedChanges(true));

      const { preventDefault } = createAndClickAnchor('http://localhost/other-page');

      expect(window.confirm).toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
    });

    it('allows navigation without confirm when isDirty=false', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      renderHook(() => useUnsavedChanges(false));

      const { preventDefault } = createAndClickAnchor('http://localhost/other-page');

      expect(window.confirm).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
    });

    it('removes click listener on unmount so confirm is not shown after unmount', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      const { unmount } = renderHook(() => useUnsavedChanges(true));
      unmount();

      createAndClickAnchor('http://localhost/other-page');

      expect(window.confirm).not.toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
    });

    it('skips hash-only links on the same pathname', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      renderHook(() => useUnsavedChanges(true));

      // jsdom のデフォルト location は http://localhost/ なのでパスは "/"
      const { preventDefault } = createAndClickAnchor('http://localhost/#section');

      expect(window.confirm).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
    });
  });
});
