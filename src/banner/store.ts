import { safeStorage, type StorageLike } from '../shared/storage';
import { Store } from '../shared/store-base';
import { toDate } from '../shared/time';
import type { BannerData, BannerOptions } from './types';

const PREFIX = 'pingly-banner-dismissed:';
let counter = 0;

const time = (value: BannerOptions['startsAt']) =>
  value === undefined ? undefined : toDate(value).getTime();

export function isActive(banner: BannerData<unknown>, now = Date.now()): boolean {
  const start = time(banner.startsAt);
  const end = time(banner.endsAt);
  return (start === undefined || now >= start) && (end === undefined || now < end);
}

/** Banners for one host, highest priority first, newest first within a priority. */
export function selectBanners<C>(
  banners: readonly BannerData<C>[],
  hostId?: string,
  now = Date.now(),
): BannerData<C>[] {
  return banners
    .filter((b) => b.hostId === hostId && isActive(b as BannerData<unknown>, now))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || b.createdAt - a.createdAt);
}

export class BannerStore<C = unknown> extends Store<readonly BannerData<C>[]> {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly storage: () => StorageLike | null = safeStorage) {
    super([]);
  }

  /** Whether a banner with this `dismissKey` was dismissed before. */
  wasDismissed(dismissKey: string): boolean {
    return this.storage()?.getItem(PREFIX + dismissKey) === '1';
  }

  show(message: C, options: BannerOptions<C> = {}): string {
    const { id = `banner-${++counter}`, variant = 'info', ...rest } = options;
    if (rest.dismissKey && this.wasDismissed(rest.dismissKey)) return id;
    const banner: BannerData<C> = {
      dismissible: true,
      ...rest,
      id,
      variant,
      message,
      createdAt: Date.now(),
    };
    this.setState((list) => [...list.filter((b) => b.id !== id), banner]);
    this.schedule();
    return id;
  }

  update(id: string, patch: Partial<BannerOptions<C>> & { message?: C }): void {
    this.setState((list) => list.map((b) => (b.id === id ? { ...b, ...patch, id } : b)));
    this.schedule();
  }

  /** Hide a banner; remembers it when it has a `dismissKey`. */
  dismiss(id: string): void {
    const banner = this.state.find((b) => b.id === id);
    if (!banner) return;
    if (banner.dismissKey) {
      try {
        this.storage()?.setItem(PREFIX + banner.dismissKey, '1');
      } catch {
        // Best effort.
      }
    }
    this.setState((list) => list.filter((b) => b.id !== id));
    banner.onDismiss?.();
  }

  /** Forget a remembered dismissal. */
  forget(dismissKey: string): void {
    this.storage()?.removeItem(PREFIX + dismissKey);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.setState([]);
  }

  /** Re-render when the next banner starts or ends. */
  private schedule() {
    clearTimeout(this.timer);
    const now = Date.now();
    const next = this.state
      .flatMap((b) => [time(b.startsAt), time(b.endsAt)])
      .filter((t): t is number => t !== undefined && t > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    this.timer = setTimeout(
      () => {
        this.setState((list) => [...list]);
        this.schedule();
      },
      Math.min(next - now, 2 ** 31 - 1),
    );
  }
}
