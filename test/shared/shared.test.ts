import { Emitter } from '../../src/shared/emitter';
import { getFocusable, moveFocus, trapFocus } from '../../src/shared/focus';
import { computePosition } from '../../src/shared/position';
import { formatRelativeTime, groupByDay } from '../../src/shared/time';

describe('computePosition', () => {
  const viewport = { width: 1000, height: 800 };
  const anchor = { x: 900, y: 10, width: 40, height: 40 };

  it('places below, aligned to the end', () => {
    expect(
      computePosition(anchor, { width: 300, height: 200 }, { placement: 'bottom-end', viewport }),
    ).toEqual({
      x: 640,
      y: 58,
      placement: 'bottom-end',
    });
  });

  it('flips when there is no room and shifts inside the viewport', () => {
    const low = { x: 10, y: 700, width: 40, height: 40 };
    const result = computePosition(
      low,
      { width: 300, height: 200 },
      { placement: 'bottom-end', viewport },
    );
    expect(result.placement).toBe('top-end');
    expect(result.y).toBe(492);
    expect(result.x).toBe(8);
  });
});

describe('time', () => {
  const now = new Date('2026-06-15T12:00:00Z').getTime();

  it('formats relative times', () => {
    expect(formatRelativeTime(now - 10_000, { now, locale: 'en' })).toBe('now');
    expect(formatRelativeTime(now - 5 * 60_000, { now, locale: 'en' })).toBe('5 minutes ago');
    expect(formatRelativeTime(now - 3 * 3_600_000, { now, locale: 'en' })).toBe('3 hours ago');
    expect(formatRelativeTime(now - 86_400_000 * 1.2, { now, locale: 'en' })).toBe('yesterday');
  });

  it('groups by day with Today / Yesterday labels', () => {
    const items = [now - 1000, now - 86_400_000, now - 86_400_000 * 5];
    const groups = groupByDay(items, (t) => t, { now, locale: 'en' });
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Jun 10']);
  });
});

describe('Emitter', () => {
  it('delivers events and isolates throwing listeners', () => {
    const emitter = new Emitter<{ ping: number }>();
    const good = vi.fn();
    const deferred: Array<() => void> = [];
    vi.stubGlobal('queueMicrotask', (fn: () => void) => deferred.push(fn));
    emitter.on('ping', () => {
      throw new Error('boom');
    });
    emitter.on('ping', good);
    emitter.once('ping', good);
    emitter.emit('ping', 1);
    emitter.emit('ping', 2);
    expect(good.mock.calls).toEqual([[1], [1], [2]]);
    expect(() => deferred[0]!()).toThrow('boom');
    vi.unstubAllGlobals();
  });
});

describe('focus helpers', () => {
  it('traps Tab and restores focus', () => {
    document.body.innerHTML = `<button id="outside">o</button><div id="box"><button id="a">a</button><button id="b">b</button></div>`;
    const outside = document.getElementById('outside')!;
    outside.focus();
    const box = document.getElementById('box')!;
    const release = trapFocus(box);
    expect(document.activeElement?.id).toBe('a');
    document.getElementById('b')!.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    // jsdom has no default Tab behaviour; the trap wraps focus itself.
    expect(document.activeElement?.id).toBe('a');
    release();
    expect(document.activeElement).toBe(outside);
  });

  it('moves focus with arrow keys', () => {
    document.body.innerHTML = `<div id="list"><button>1</button><button>2</button><button>3</button></div>`;
    const items = getFocusable(document.getElementById('list')!);
    items[0]!.focus();
    const ev = { key: 'ArrowDown', preventDefault: vi.fn() };
    expect(moveFocus(ev, items)).toBe(items[1]);
    expect(moveFocus({ key: 'End', preventDefault() {} }, items)).toBe(items[2]);
    expect(moveFocus({ key: 'ArrowDown', preventDefault() {} }, items)).toBe(items[0]);
    expect(moveFocus({ key: 'x', preventDefault() {} }, items)).toBeNull();
  });
});
