import type { ToastData, ToastOptions, ToastUpdate } from './types';

export interface ToastStoreConfig {
  /** Default auto-dismiss duration in ms. */
  duration: number;
  /** Maximum number of toasts shown at once; the rest wait in a queue. */
  limit: number;
  /** How long a dismissed toast stays mounted so its exit animation can play. */
  exitDuration: number;
}

interface Timer {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_CONFIG: ToastStoreConfig = { duration: 4000, limit: 3, exitDuration: 200 };

let idCounter = 0;
const nextId = () => `pingly-${++idCounter}`;

/** Toasts that are currently on screen: those leaving plus the newest `limit` active ones. */
export function selectShown<C>(toasts: readonly ToastData<C>[], limit: number): ToastData<C>[] {
  const active = toasts.filter((t) => t.state === 'visible');
  const shown = new Set(active.slice(Math.max(0, active.length - limit)));
  return toasts.filter((t) => t.state === 'leaving' || shown.has(t));
}

export class ToastStore<C = unknown> {
  private toasts: readonly ToastData<C>[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly timers = new Map<string, Timer>();
  private readonly removals = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pauseReasons = new Set<string>();
  private config: ToastStoreConfig;

  constructor(config: Partial<ToastStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly ToastData<C>[] => this.toasts;

  getConfig(): Readonly<ToastStoreConfig> {
    return this.config;
  }

  configure(patch: Partial<ToastStoreConfig>): void {
    this.config = { ...this.config, ...withoutUndefined(patch) };
    this.syncTimers();
  }

  add(title: C, options: ToastOptions<C> = {}): string {
    const { id = nextId(), type = 'default', ...rest } = options;
    if (this.toasts.some((t) => t.id === id && t.state === 'visible')) {
      this.update(id, { ...options, title });
      return id;
    }
    const toast: ToastData<C> = {
      dismissible: true,
      ...withoutUndefined(rest),
      id,
      type,
      title,
      state: 'visible',
      createdAt: Date.now(),
    };
    this.commit([...this.toasts.filter((t) => t.id !== id), toast]);
    return id;
  }

  /** Patch a visible toast. Its auto-dismiss timer restarts. */
  update(id: string, patch: ToastUpdate<C>): void {
    const clean = withoutUndefined(patch);
    let found = false;
    const next = this.toasts.map((t) => {
      if (t.id !== id || t.state !== 'visible') return t;
      found = true;
      return { ...t, ...clean };
    });
    if (!found) return;
    this.clearTimer(id);
    this.commit(next);
  }

  /** Dismiss one toast, or every toast when `id` is omitted. */
  dismiss(id?: string): void {
    this.close(id, false);
  }

  /** Remove a toast immediately, skipping the exit phase. */
  remove(id: string): void {
    this.clearTimer(id);
    const removal = this.removals.get(id);
    if (removal) clearTimeout(removal);
    this.removals.delete(id);
    this.commit(this.toasts.filter((t) => t.id !== id));
  }

  /**
   * Pause every auto-dismiss timer. Several independent reasons (hover,
   * focus, window blur) can hold a pause; timers resume once all are released.
   */
  pause(reason = 'manual'): void {
    if (this.pauseReasons.size === 0) {
      const now = Date.now();
      for (const timer of this.timers.values()) this.stopTimer(timer, now);
    }
    this.pauseReasons.add(reason);
  }

  resume(reason = 'manual'): void {
    if (!this.pauseReasons.delete(reason)) return;
    if (this.pauseReasons.size === 0) this.syncTimers();
  }

  isPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  /** Clear all toasts, timers and pauses. */
  reset(): void {
    for (const timer of this.timers.values()) if (timer.handle) clearTimeout(timer.handle);
    for (const handle of this.removals.values()) clearTimeout(handle);
    this.timers.clear();
    this.removals.clear();
    this.pauseReasons.clear();
    this.config = { ...DEFAULT_CONFIG };
    this.commit([]);
  }

  private close(id: string | undefined, auto: boolean): void {
    const targets = this.toasts.filter(
      (t) => t.state === 'visible' && (id === undefined || t.id === id),
    );
    if (targets.length === 0) return;
    const ids = new Set(targets.map((t) => t.id));
    for (const t of targets) {
      this.clearTimer(t.id);
      this.removals.set(
        t.id,
        setTimeout(() => this.remove(t.id), this.config.exitDuration),
      );
    }
    this.commit(this.toasts.map((t) => (ids.has(t.id) ? { ...t, state: 'leaving' } : t)));
    for (const t of targets) (auto ? t.onAutoClose : t.onDismiss)?.(t);
  }

  private commit(next: readonly ToastData<C>[]): void {
    this.toasts = next;
    this.syncTimers();
    for (const listener of this.listeners) listener();
  }

  /** Run timers for shown toasts only; queued toasts wait their turn. */
  private syncTimers(): void {
    const now = Date.now();
    const shown = new Set(selectShown(this.toasts, this.config.limit).map((t) => t.id));
    for (const toast of this.toasts) {
      if (toast.state !== 'visible') continue;
      const timer = this.timers.get(toast.id);
      if (!shown.has(toast.id)) {
        if (timer) this.stopTimer(timer, now);
        continue;
      }
      if (this.isPaused()) continue;
      if (timer) {
        if (!timer.handle) this.startTimer(toast.id, timer, now);
        continue;
      }
      const duration =
        toast.duration ?? (toast.type === 'loading' ? Infinity : this.config.duration);
      if (!Number.isFinite(duration)) continue;
      const fresh: Timer = { remaining: Math.max(0, duration), startedAt: now, handle: null };
      this.timers.set(toast.id, fresh);
      this.startTimer(toast.id, fresh, now);
    }
  }

  private startTimer(id: string, timer: Timer, now: number): void {
    timer.startedAt = now;
    timer.handle = setTimeout(() => {
      this.timers.delete(id);
      this.close(id, true);
    }, timer.remaining);
  }

  private stopTimer(timer: Timer, now: number): void {
    if (!timer.handle) return;
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = Math.max(0, timer.remaining - (now - timer.startedAt));
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
  }
}

function withoutUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
