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

  it('does not register beforeunload listener when isDirty is false', () => {
    renderHook(() => useUnsavedChanges(false));

    const beforeUnloadCalls = addEventListenerSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'beforeunload'
    );
    expect(beforeUnloadCalls).toHaveLength(0);
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

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChanges(true));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });

  it('removes listener when isDirty changes from true to false', () => {
    const { rerender } = renderHook(
      ({ isDirty }) => useUnsavedChanges(isDirty),
      { initialProps: { isDirty: true } }
    );

    rerender({ isDirty: false });

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
  });
});
