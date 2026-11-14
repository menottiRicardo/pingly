import { ToastStore, selectShown } from '../src/store';

describe('ToastStore', () => {
  let store: ToastStore<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ToastStore<string>({ duration: 1000, exitDuration: 100 });
  });

  it('adds toasts with defaults and notifies subscribers', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    const id = store.add('Hello');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toMatchObject([
      { id, title: 'Hello', type: 'default', state: 'visible', dismissible: true },
    ]);
  });

  it('auto-dismisses after the duration, then removes after the exit phase', () => {
    const onAutoClose = vi.fn();
    const onDismiss = vi.fn();
    store.add('Bye', { onAutoClose, onDismiss });
    vi.advanceTimersByTime(999);
    expect(store.getSnapshot()[0]?.state).toBe('visible');
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot()[0]?.state).toBe('leaving');
    expect(onAutoClose).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('respects per-toast duration and Infinity', () => {
    store.add('short', { duration: 50 });
    store.add('forever', { duration: Infinity });
    store.add('spinner', { type: 'loading' });
    vi.advanceTimersByTime(10_000);
    expect(store.getSnapshot().map((t) => t.title)).toEqual(['forever', 'spinner']);
  });

  it('dismisses one or all toasts and calls onDismiss', () => {
    const onDismiss = vi.fn();
    const a = store.add('a', { onDismiss });
    store.add('b');
    store.add('c');
    store.dismiss(a);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(store.getSnapshot().map((t) => t.state)).toEqual(['leaving', 'visible', 'visible']);
    store.dismiss();
    expect(store.getSnapshot().every((t) => t.state === 'leaving')).toBe(true);
  });

  it('updates an existing toast and restarts its timer', () => {
    const id = store.add('Saving', { type: 'loading' });
    vi.advanceTimersByTime(5000);
    store.update(id, { type: 'success', title: 'Saved' });
    expect(store.getSnapshot()[0]).toMatchObject({ type: 'success', title: 'Saved' });
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot()[0]?.state).toBe('leaving');
  });

  it('reusing an id updates instead of duplicating', () => {
    store.add('one', { id: 'x' });
    store.add('two', { id: 'x' });
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0]?.title).toBe('two');
  });

  it('pauses and resumes timers, keeping the remaining time', () => {
    store.add('paused');
    vi.advanceTimersByTime(600);
    store.pause('hover');
    vi.advanceTimersByTime(5000);
    expect(store.getSnapshot()[0]?.state).toBe('visible');
    store.resume('hover');
    vi.advanceTimersByTime(399);
    expect(store.getSnapshot()[0]?.state).toBe('visible');
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot()[0]?.state).toBe('leaving');
  });

  it('stays paused until every pause reason is released', () => {
    store.add('x');
    store.pause('hover');
    store.pause('window');
    store.resume('hover');
    vi.advanceTimersByTime(5000);
    expect(store.getSnapshot()[0]?.state).toBe('visible');
    store.resume('window');
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot()[0]?.state).toBe('leaving');
  });

  it('queues toasts beyond the limit without running their timers', () => {
    store.configure({ limit: 1 });
    store.add('first');
    store.add('second');
    expect(selectShown(store.getSnapshot(), 1).map((t) => t.title)).toEqual(['second']);
    vi.advanceTimersByTime(1000);
    // "second" closed; "first" now shows and starts its own timer.
    expect(store.getSnapshot().find((t) => t.title === 'first')?.state).toBe('visible');
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().find((t) => t.title === 'first')?.state).toBe('leaving');
  });
});
