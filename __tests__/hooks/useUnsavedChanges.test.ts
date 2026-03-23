import { renderHook } from '@testing-library/react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

describe('useUnsavedChanges', () => {
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;
  let originalPushState: typeof history.pushState;

  beforeEach(() => {
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    originalPushState = history.pushState;
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    history.pushState = originalPushState;
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

  it('restores history.pushState on unmount (confirm no longer required)', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    const { unmount } = renderHook(() => useUnsavedChanges(true));
    // フックがオーバーライドした pushState は confirm=false でブロックする
    history.pushState({}, '', '/blocked');
    expect(window.confirm).toHaveBeenCalledTimes(1);

    unmount();

    // アンマウント後は元の pushState に戻るため confirm なしで通過する
    (window.confirm as jest.Mock).mockClear();
    history.pushState({}, '', '/allowed');
    expect(window.confirm).not.toHaveBeenCalled();

    (window.confirm as jest.Mock).mockRestore();
  });

  describe('history.pushState intercept', () => {
    it('blocks pushState and shows confirm when isDirty=true and user cancels', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      const pushStateSpy = jest.spyOn(history, 'pushState');

      renderHook(() => useUnsavedChanges(true));

      history.pushState({}, '', '/other-page');

      expect(window.confirm).toHaveBeenCalled();
      // originalPushState は上書きされているので pushStateSpy は呼ばれない
      expect(pushStateSpy).not.toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
      pushStateSpy.mockRestore();
    });

    it('allows pushState when isDirty=true and user confirms', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const pushStateCalled = jest.fn();
      const origPush = originalPushState;
      // originalPushState をモックに差し替えて呼び出しを検知する
      history.pushState = origPush; // リセットしてからフックにオーバーライドさせる
      jest.spyOn(history, 'pushState').mockImplementation(pushStateCalled);

      renderHook(() => useUnsavedChanges(true));

      history.pushState({}, '', '/other-page');

      expect(window.confirm).toHaveBeenCalled();
      expect(pushStateCalled).toHaveBeenCalledWith({}, '', '/other-page');

      (window.confirm as jest.Mock).mockRestore();
    });

    it('allows pushState without confirm when isDirty=false', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      renderHook(() => useUnsavedChanges(false));

      // confirm が呼ばれないことを確認（pushState 自体の呼び出しはここでは検証省略）
      history.pushState({}, '', '/other-page');

      expect(window.confirm).not.toHaveBeenCalled();

      (window.confirm as jest.Mock).mockRestore();
    });
  });
});
