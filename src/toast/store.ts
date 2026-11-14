import type { ToastData, ToastOptions, ToastUpdate } from './types';

export interface ToastStoreConfig {
  /** Default auto-dismiss duration in ms. */
  duration: number;
  /** Default maximum number of toasts shown at once per toaster; the rest wait in a queue. */
  limit: number;
  /** How long a dismissed toast stays mounted so its exit animation can play. */
  exitDuration: number;
}

interface Timer {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

type InternalUpdate<C> = ToastUpdate<C> & { count?: number; render?: (id: string) => C };

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
  private readonly limits = new Map<string | undefined, number>();
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

  /** Whether timers are currently paused (hover, focus, window blur, swipe…). */
  getPaused = (): boolean => this.pauseReasons.size > 0;

  getConfig(): Readonly<ToastStoreConfig> {
    return this.config;
  }

  configure(patch: Partial<ToastStoreConfig>): void {
    this.config = { ...this.config, ...withoutUndefined(patch) };
    this.syncTimers();
  }

  /** Set how many toasts a specific toaster shows at once. */
  setLimit(toasterId: string | undefined, limit: number | undefined): void {
    if (limit === undefined) this.limits.delete(toasterId);
    else this.limits.set(toasterId, limit);
    this.syncTimers();
  }

  limitFor(toasterId: string | undefined): number {
    return this.limits.get(toasterId) ?? this.config.limit;
  }

  /** Effective auto-dismiss time for a toast; `Infinity` when it stays open. */
  durationOf(toast: ToastData<C>): number {
    return toast.duration ?? (toast.type === 'loading' ? Infinity : this.config.duration);
  }

  add(title: C, options: ToastOptions<C> & { render?: (id: string) => C } = {}): string {
    const { id = nextId(), type = 'default', ...rest } = options;
    if (this.find(id)) {
      this.update(id, { ...options, title });
      return id;
    }
    if (options.dedupeKey !== undefined) {
      const twin = this.toasts.find(
        (t) =>
          t.state === 'visible' &&
          t.dedupeKey === options.dedupeKey &&
          t.toasterId === options.toasterId,
      );
      if (twin) {
        this.update(twin.id, { ...rest, type, title, count: twin.count + 1 });
        return twin.id;
      }
    }
    const now = Date.now();
    const toast: ToastData<C> = {
      dismissible: true,
      ...withoutUndefined(rest),
      id,
      type,
      title,
      state: 'visible',
      createdAt: now,
      updatedAt: now,
      count: 1,
    };
    this.commit([...this.toasts.filter((t) => t.id !== id), toast]);
    return id;
  }

  /** Patch a visible toast. Its auto-dismiss timer restarts. */
  update(id: string, patch: InternalUpdate<C>): void {
    const clean = withoutUndefined(patch);
    let found = false;
    const next = this.toasts.map((t) => {
      if (t.id !== id || t.state !== 'visible') return t;
      found = true;
      return { ...t, ...clean, updatedAt: Date.now() };
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
   * focus, window blur, swipe) can hold a pause; timers resume once all are released.
   */
  pause(reason = 'manual'): void {
    const wasPaused = this.getPaused();
    if (!wasPaused) {
      const now = Date.now();
      for (const timer of this.timers.values()) this.stopTimer(timer, now);
    }
    this.pauseReasons.add(reason);
    if (!wasPaused) this.emit();
  }

  resume(reason = 'manual'): void {
    if (!this.pauseReasons.delete(reason)) return;
    if (this.pauseReasons.size === 0) {
      this.syncTimers();
      this.emit();
    }
  }

  /** Clear all toasts, timers, limits and pauses. */
  reset(): void {
    for (const timer of this.timers.values()) if (timer.handle) clearTimeout(timer.handle);
    for (const handle of this.removals.values()) clearTimeout(handle);
    this.timers.clear();
    this.removals.clear();
    this.pauseReasons.clear();
    this.limits.clear();
    this.config = { ...DEFAULT_CONFIG };
    this.commit([]);
  }

  private find(id: string): ToastData<C> | undefined {
    return this.toasts.find((t) => t.id === id && t.state === 'visible');
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
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private shownIds(): Set<string> {
    const byToaster = new Map<string | undefined, ToastData<C>[]>();
    for (const t of this.toasts) {
      const list = byToaster.get(t.toasterId);
      if (list) list.push(t);
      else byToaster.set(t.toasterId, [t]);
    }
    const ids = new Set<string>();
    for (const [toasterId, list] of byToaster) {
      for (const t of selectShown(list, this.limitFor(toasterId))) ids.add(t.id);
    }
    return ids;
  }

  /** Run timers for shown toasts only; queued toasts wait their turn. */
  private syncTimers(): void {
    const now = Date.now();
    const shown = this.shownIds();
    for (const toast of this.toasts) {
      if (toast.state !== 'visible') continue;
      const timer = this.timers.get(toast.id);
      if (!shown.has(toast.id)) {
        if (timer) this.stopTimer(timer, now);
        continue;
      }
      if (this.getPaused()) continue;
      if (timer) {
        if (!timer.handle) this.startTimer(toast.id, timer, now);
        continue;
      }
      const duration = this.durationOf(toast);
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
