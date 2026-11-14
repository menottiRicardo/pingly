import { SwipeTracker, swipeConfigFor } from '../../src/toast/swipe';
import { ToastStore, selectShown } from '../../src/toast/store';
import { createToastApi } from '../../src/toast/api';
import { describeHotkey, matchesHotkey } from '../../src/toast/dom';

describe('swipe', () => {
  it('swipes toward the nearest screen edge', () => {
    expect(swipeConfigFor('bottom-right')).toEqual({ axis: 'x', direction: 1 });
    expect(swipeConfigFor('top-left')).toEqual({ axis: 'x', direction: -1 });
    expect(swipeConfigFor('top-center')).toEqual({ axis: 'y', direction: -1 });
    expect(swipeConfigFor('bottom-center')).toEqual({ axis: 'y', direction: 1 });
  });

  it('dismisses past the distance threshold in the allowed direction', () => {
    const t = new SwipeTracker({ axis: 'x', direction: 1 }, 45, 10);
    t.begin(0, 0, 0);
    expect(t.move(60, 5)).toBe(60);
    expect(t.end(1000)).toMatchObject({ dismiss: true, sign: 1 });
  });

  it('damps and refuses the wrong direction', () => {
    const t = new SwipeTracker({ axis: 'x', direction: 1 }, 45, 10);
    t.begin(0, 0, 0);
    expect(t.move(-100, 0)).toBeCloseTo(-15);
    expect(t.end(1000).dismiss).toBe(false);
  });

  it('dismisses a fast short flick', () => {
    const t = new SwipeTracker({ axis: 'y', direction: 0 });
    t.begin(0, 0, 0);
    t.move(0, -20);
    expect(t.end(50).dismiss).toBe(true);
  });
});

describe('toast store upgrades', () => {
  beforeEach(() => vi.useFakeTimers());

  it('dedupes by key and counts repeats', () => {
    const store = new ToastStore<string>();
    const a = store.add('Saved', { dedupeKey: 'save' });
    const b = store.add('Saved again', { dedupeKey: 'save' });
    expect(b).toBe(a);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.getSnapshot()[0]).toMatchObject({ title: 'Saved again', count: 2 });
  });

  it('applies limits per toaster', () => {
    const store = new ToastStore<string>({ duration: 1000 });
    store.setLimit('side', 1);
    store.add('main 1');
    store.add('main 2');
    store.add('side 1', { toasterId: 'side' });
    store.add('side 2', { toasterId: 'side' });
    const side = store.getSnapshot().filter((t) => t.toasterId === 'side');
    expect(selectShown(side, store.limitFor('side')).map((t) => t.title)).toEqual(['side 2']);
    vi.advanceTimersByTime(1000);
    // Both main toasts and the shown side toast closed; the queued side toast is still waiting.
    const states = Object.fromEntries(store.getSnapshot().map((t) => [t.title, t.state]));
    expect(states).toMatchObject({
      'main 1': 'leaving',
      'main 2': 'leaving',
      'side 2': 'leaving',
      'side 1': 'visible',
    });
  });

  it('reports pause changes to subscribers', () => {
    const store = new ToastStore<string>();
    const listener = vi.fn();
    store.subscribe(listener);
    store.pause('hover');
    expect(store.getPaused()).toBe(true);
    store.pause('focus');
    store.resume('hover');
    expect(store.getPaused()).toBe(true);
    store.resume('focus');
    expect(store.getPaused()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('bumps updatedAt on update and resolves durations', () => {
    const store = new ToastStore<string>({ duration: 3000 });
    const id = store.add('x');
    const first = store.getSnapshot()[0]!;
    expect(store.durationOf(first)).toBe(3000);
    vi.advanceTimersByTime(10);
    store.update(id, { title: 'y' });
    expect(store.getSnapshot()[0]!.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(store.durationOf({ ...first, type: 'loading' })).toBe(Infinity);
  });

  it('creates custom toasts', () => {
    const store = new ToastStore<string>();
    const toast = createToastApi(store);
    const id = toast.custom((tid) => `custom ${tid}`);
    const t = store.getSnapshot()[0]!;
    expect(t.render?.(id)).toBe(`custom ${id}`);
    expect(t.unstyled).toBe(true);
  });
});

describe('hotkeys', () => {
  const key = (init: Partial<KeyboardEventInit & { code: string }>) => ({
    code: '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...init,
  });

  it('matches modifiers plus code', () => {
    expect(matchesHotkey(key({ altKey: true, code: 'KeyT' }), ['altKey', 'KeyT'])).toBe(true);
    expect(matchesHotkey(key({ code: 'KeyT' }), ['altKey', 'KeyT'])).toBe(false);
    expect(matchesHotkey(key({ altKey: true, code: 'KeyT' }), [])).toBe(false);
    expect(describeHotkey(['altKey', 'KeyT'])).toBe('alt+T');
  });
});
