import { Emitter } from '../shared/emitter';
import { Store } from '../shared/store-base';
import { createTabChannel, type TabChannel } from '../shared/tab-channel';
import { toDate } from '../shared/time';
import { memoryAdapter } from './adapters';
import type { InboxAdapter, InboxFilter, InboxMutation, InboxState, Notification } from './types';

export interface InboxOptions<C = unknown, P = unknown> {
  /** Where notifications come from. Defaults to an in-memory adapter. */
  adapter?: InboxAdapter<C, P>;
  /** Items per page. Defaults to `20`. */
  pageSize?: number;
  /** Initial filter. Defaults to `{ status: 'all' }`. */
  filter?: InboxFilter;
  /** Share read/archive changes with other open tabs. `true` or a channel name. */
  syncTabs?: boolean | string;
}

export interface InboxEvents<C, P> {
  /** New notifications arrived through `receive()`. */
  received: Notification<C, P>[];
  /** A backend call failed and the optimistic change was rolled back. */
  error: { action: InboxMutation | 'load'; error: unknown };
}

interface TabMessage {
  kind: InboxMutation;
  ids: string[];
  at: string;
}

export const isUnread = (n: Notification<unknown, unknown>) => !n.readAt && !n.archivedAt;

export function matchesFilter(n: Notification<unknown, unknown>, filter: InboxFilter): boolean {
  const status = filter.status ?? 'all';
  if (status === 'archived' ? !n.archivedAt : n.archivedAt) return false;
  if (status === 'unread' && n.readAt) return false;
  if (filter.category !== undefined && n.category !== filter.category) return false;
  return true;
}

const time = (n: Notification<unknown, unknown>) => toDate(n.createdAt).getTime();

const INITIAL: InboxState<never, never> = {
  items: {},
  order: [],
  filter: { status: 'all' },
  status: 'idle',
  loadingMore: false,
  error: null,
  cursor: null,
  hasMore: false,
  serverUnread: null,
  lastReceivedAt: null,
};

export class InboxStore<C = unknown, P = unknown> extends Store<InboxState<C, P>> {
  readonly events = new Emitter<InboxEvents<C, P>>();
  readonly adapter: InboxAdapter<C, P>;
  private readonly pageSize: number;
  private abort: AbortController | null = null;
  private channel: TabChannel<TabMessage> | null = null;
  private visibleCache: { state: InboxState<C, P>; value: Notification<C, P>[] } | null = null;
  private unreadCache: { state: InboxState<C, P>; value: number } | null = null;

  constructor({ adapter, pageSize = 20, filter, syncTabs = false }: InboxOptions<C, P> = {}) {
    super({ ...(INITIAL as InboxState<C, P>), filter: filter ?? { status: 'all' } });
    this.adapter = adapter ?? memoryAdapter<C, P>();
    this.pageSize = pageSize;
    if (syncTabs) {
      const name = typeof syncTabs === 'string' ? syncTabs : 'pingly-inbox';
      this.channel = createTabChannel<TabMessage>(name, (m) =>
        this.applyLocal(m.kind, m.ids, m.at),
      );
    }
  }

  /** Notifications matching the current filter, newest first. Stable between changes. */
  getVisible = (): Notification<C, P>[] => {
    const state = this.state;
    if (this.visibleCache?.state === state) return this.visibleCache.value;
    const value = state.order
      .map((id) => state.items[id]!)
      .filter((n) => matchesFilter(n as Notification<unknown, unknown>, state.filter));
    this.visibleCache = { state, value };
    return value;
  };

  /** Unread count: the backend's number when known, else counted from loaded items. */
  getUnreadCount = (): number => {
    const state = this.state;
    if (this.unreadCache?.state === state) return this.unreadCache.value;
    const value =
      state.serverUnread ??
      state.order.filter((id) => isUnread(state.items[id] as Notification<unknown, unknown>))
        .length;
    this.unreadCache = { state, value };
    return value;
  };

  get(id: string): Notification<C, P> | undefined {
    return this.state.items[id];
  }

  /** Load the first page for a filter (the current one by default). */
  async load(filter: InboxFilter = this.state.filter): Promise<void> {
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    this.setState((s) => ({
      ...s,
      filter,
      status: 'loading',
      error: null,
      cursor: null,
      hasMore: false,
    }));
    try {
      const page = await this.adapter.list({
        cursor: null,
        filter,
        limit: this.pageSize,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      this.merge(page.items, (s) => ({
        ...s,
        status: 'ready',
        cursor: page.nextCursor ?? null,
        hasMore: Boolean(page.nextCursor),
        serverUnread: page.unreadCount ?? s.serverUnread,
      }));
      if (page.unreadCount === undefined && this.adapter.unreadCount)
        void this.refreshUnreadCount();
    } catch (error) {
      if (controller.signal.aborted) return;
      this.setState((s) => ({ ...s, status: 'error', error }));
      this.events.emit('error', { action: 'load', error });
    }
  }

  /** Load the next page, if there is one. */
  async loadMore(): Promise<void> {
    const { hasMore, loadingMore, status, cursor, filter } = this.state;
    if (!hasMore || loadingMore || status !== 'ready') return;
    this.setState((s) => ({ ...s, loadingMore: true }));
    try {
      const page = await this.adapter.list({ cursor, filter, limit: this.pageSize });
      this.merge(page.items, (s) => ({
        ...s,
        loadingMore: false,
        cursor: page.nextCursor ?? null,
        hasMore: Boolean(page.nextCursor),
        serverUnread: page.unreadCount ?? s.serverUnread,
      }));
    } catch (error) {
      this.setState((s) => ({ ...s, loadingMore: false, error }));
      this.events.emit('error', { action: 'load', error });
    }
  }

  setFilter(filter: InboxFilter): Promise<void> {
    return this.load(filter);
  }

  async refreshUnreadCount(): Promise<void> {
    if (!this.adapter.unreadCount) return;
    try {
      const count = await this.adapter.unreadCount();
      this.setState((s) => ({ ...s, serverUnread: count }));
    } catch {
      // Keep the current count.
    }
  }

  /** Add notifications that just arrived (e.g. from a realtime connection). */
  receive(input: Notification<C, P> | Notification<C, P>[]): void {
    const list = Array.isArray(input) ? input : [input];
    const fresh = list.filter((n) => !this.state.items[n.id]);
    const newUnread = fresh.filter((n) => isUnread(n as Notification<unknown, unknown>)).length;
    this.merge(list, (s) => ({
      ...s,
      serverUnread: s.serverUnread === null ? null : s.serverUnread + newUnread,
      lastReceivedAt: fresh.length ? Date.now() : s.lastReceivedAt,
    }));
    if (fresh.length) this.events.emit('received', fresh);
  }

  /** Insert or replace notifications without treating them as new arrivals. */
  upsert(input: Notification<C, P> | Notification<C, P>[]): void {
    this.merge(Array.isArray(input) ? input : [input], (s) => s);
  }

  markRead(ids: string | string[]): Promise<void> {
    return this.mutate('read', toIds(ids), () => this.adapter.markRead?.(toIds(ids)));
  }

  markUnread(ids: string | string[]): Promise<void> {
    return this.mutate('unread', toIds(ids), () => this.adapter.markUnread?.(toIds(ids)));
  }

  markAllRead(): Promise<void> {
    const ids = this.state.order.filter((id) =>
      isUnread(this.state.items[id] as Notification<unknown, unknown>),
    );
    return this.mutate('readAll', ids, () => this.adapter.markAllRead?.());
  }

  archive(ids: string | string[]): Promise<void> {
    return this.mutate('archive', toIds(ids), () => this.adapter.archive?.(toIds(ids)));
  }

  unarchive(ids: string | string[]): Promise<void> {
    return this.mutate('unarchive', toIds(ids), () => this.adapter.unarchive?.(toIds(ids)));
  }

  remove(ids: string | string[]): Promise<void> {
    return this.mutate('remove', toIds(ids), () => this.adapter.remove?.(toIds(ids)));
  }

  /** Forget everything and go back to the idle state. */
  reset(): void {
    this.abort?.abort();
    this.setState({ ...(INITIAL as InboxState<C, P>), filter: this.state.filter });
  }

  /** Stop syncing with other tabs and cancel pending requests. */
  destroy(): void {
    this.abort?.abort();
    this.channel?.close();
    this.events.clear();
  }

  private merge(list: Notification<C, P>[], update: (s: InboxState<C, P>) => InboxState<C, P>) {
    this.setState((s) => {
      const items = { ...s.items };
      for (const n of list) items[n.id] = n;
      return update({ ...s, items, order: sortIds(items) });
    });
  }

  /** Apply a change locally and return the items it replaced. */
  private applyLocal(kind: InboxMutation, ids: string[], at: string) {
    const before: Record<string, Notification<C, P>> = {};
    let unreadDelta = 0;
    this.setState((s) => {
      const items = { ...s.items };
      for (const id of ids) {
        const n = items[id];
        if (!n) continue;
        before[id] = n;
        const next = patch(n, kind, at);
        const wasUnread = isUnread(n as Notification<unknown, unknown>);
        const nowUnread = next ? isUnread(next as Notification<unknown, unknown>) : false;
        unreadDelta += Number(nowUnread) - Number(wasUnread);
        if (next) items[id] = next;
        else delete items[id];
      }
      let serverUnread = s.serverUnread;
      if (serverUnread !== null)
        serverUnread = kind === 'readAll' ? 0 : Math.max(0, serverUnread + unreadDelta);
      return { ...s, items, order: sortIds(items), serverUnread };
    });
    return { before, unreadDelta };
  }

  private async mutate(kind: InboxMutation, ids: string[], call: () => Promise<void> | undefined) {
    if (ids.length === 0 && kind !== 'readAll') return;
    const prevUnread = this.state.serverUnread;
    const at = new Date().toISOString();
    const { before } = this.applyLocal(kind, ids, at);
    this.channel?.post({ kind, ids, at });
    try {
      await call();
    } catch (error) {
      this.setState((s) => {
        const items = { ...s.items, ...before };
        return { ...s, items, order: sortIds(items), serverUnread: prevUnread };
      });
      this.events.emit('error', { action: kind, error });
    }
  }
}

function toIds(ids: string | string[]): string[] {
  return Array.isArray(ids) ? ids : [ids];
}

function sortIds<C, P>(items: Record<string, Notification<C, P>>): string[] {
  return Object.values(items)
    .sort(
      (a, b) =>
        time(b as Notification<unknown, unknown>) - time(a as Notification<unknown, unknown>),
    )
    .map((n) => n.id);
}

function patch<C, P>(
  n: Notification<C, P>,
  kind: InboxMutation,
  at: string,
): Notification<C, P> | null {
  switch (kind) {
    case 'read':
    case 'readAll':
      return n.readAt ? n : { ...n, readAt: at };
    case 'unread':
      return { ...n, readAt: null };
    case 'archive':
      return { ...n, archivedAt: at, readAt: n.readAt ?? at };
    case 'unarchive':
      return { ...n, archivedAt: null };
    case 'remove':
      return null;
  }
}
