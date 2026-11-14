import { toDate } from '../shared/time';
import type { InboxAdapter, InboxFilter, InboxPage, ListParams, Notification } from './types';

function matches(n: Notification<unknown, unknown>, filter: InboxFilter): boolean {
  const status = filter.status ?? 'all';
  if (status === 'archived' ? !n.archivedAt : n.archivedAt) return false;
  if (status === 'unread' && n.readAt) return false;
  return filter.category === undefined || n.category === filter.category;
}

const wait = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export interface MemoryAdapter<C, P> extends Required<InboxAdapter<C, P>> {
  /** The stored notifications, newest first. */
  readonly items: Notification<C, P>[];
  /** Add a notification to the store (does not notify an inbox; call `inbox.receive`). */
  push(notification: Notification<C, P>): void;
}

/** Keeps notifications in memory. Handy for demos, tests and local-only apps. */
export function memoryAdapter<C = unknown, P = unknown>(
  seed: Notification<C, P>[] = [],
  { latency = 0 }: { latency?: number } = {},
): MemoryAdapter<C, P> {
  let items = [...seed];
  const sort = () =>
    items.sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
  const update = (ids: string[], fn: (n: Notification<C, P>) => Notification<C, P>) => {
    const set = new Set(ids);
    items = items.map((n) => (set.has(n.id) ? fn(n) : n));
  };
  const now = () => new Date().toISOString();
  sort();
  return {
    get items() {
      return items;
    },
    push(notification) {
      items = [notification, ...items.filter((n) => n.id !== notification.id)];
      sort();
    },
    async list({ cursor, filter, limit }: ListParams): Promise<InboxPage<C, P>> {
      await wait(latency);
      const all = items.filter((n) => matches(n as Notification<unknown, unknown>, filter));
      const start = cursor ? Number(cursor) : 0;
      const end = start + limit;
      return {
        items: all.slice(start, end),
        nextCursor: end < all.length ? String(end) : null,
        unreadCount: items.filter((n) => !n.readAt && !n.archivedAt).length,
      };
    },
    async markRead(ids) {
      await wait(latency);
      update(ids, (n) => ({ ...n, readAt: n.readAt ?? now() }));
    },
    async markUnread(ids) {
      await wait(latency);
      update(ids, (n) => ({ ...n, readAt: null }));
    },
    async markAllRead() {
      await wait(latency);
      items = items.map((n) => (n.readAt ? n : { ...n, readAt: now() }));
    },
    async archive(ids) {
      await wait(latency);
      update(ids, (n) => ({ ...n, archivedAt: now(), readAt: n.readAt ?? now() }));
    },
    async unarchive(ids) {
      await wait(latency);
      update(ids, (n) => ({ ...n, archivedAt: null }));
    },
    async remove(ids) {
      await wait(latency);
      const set = new Set(ids);
      items = items.filter((n) => !set.has(n.id));
    },
    async unreadCount() {
      await wait(latency);
      return items.filter((n) => !n.readAt && !n.archivedAt).length;
    },
  };
}

export interface RestEndpoints {
  /** `GET` — receives `cursor`, `limit`, `status` and `category` query params. */
  list: string;
  /** `POST { ids }` */
  markRead: string;
  /** `POST { ids }` */
  markUnread: string;
  /** `POST` */
  markAllRead: string;
  /** `POST { ids }` */
  archive: string;
  /** `POST { ids }` */
  unarchive: string;
  /** `POST { ids }` */
  remove: string;
  /** `GET` — returns `{ count }`. */
  unreadCount: string;
}

export interface RestAdapterOptions<C, P> {
  baseUrl: string;
  /** Static headers or a function that returns them (e.g. a fresh auth token). */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  endpoints?: Partial<RestEndpoints>;
  /** Turn your API's list response into an inbox page. Defaults to `{ items, nextCursor, unreadCount }`. */
  mapPage?: (json: unknown) => InboxPage<C, P>;
  credentials?: RequestCredentials;
  fetch?: typeof fetch;
}

const DEFAULT_ENDPOINTS: RestEndpoints = {
  list: '/notifications',
  markRead: '/notifications/read',
  markUnread: '/notifications/unread',
  markAllRead: '/notifications/read-all',
  archive: '/notifications/archive',
  unarchive: '/notifications/unarchive',
  remove: '/notifications/delete',
  unreadCount: '/notifications/unread-count',
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'HttpError';
  }
}

/** Talks to a JSON REST API with `fetch`. */
export function restAdapter<C = unknown, P = unknown>(
  options: RestAdapterOptions<C, P>,
): Required<InboxAdapter<C, P>> {
  const endpoints = { ...DEFAULT_ENDPOINTS, ...options.endpoints };
  const base = options.baseUrl.replace(/\/$/, '');
  const mapPage = options.mapPage ?? ((json) => json as InboxPage<C, P>);

  async function request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ) {
    const doFetch = options.fetch ?? fetch;
    const extra =
      typeof options.headers === 'function' ? await options.headers() : (options.headers ?? {});
    const headers = new Headers(extra);
    headers.set('Accept', 'application/json');
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: options.credentials,
      signal,
    });
    const text = await res.text();
    const json: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) throw new HttpError(res.status, json);
    return json;
  }

  const post = (path: string) => async (ids: string[]) => {
    await request('POST', path, { ids });
  };

  return {
    async list({ cursor, filter, limit, signal }) {
      const query = new URLSearchParams({ limit: String(limit), status: filter.status ?? 'all' });
      if (cursor) query.set('cursor', cursor);
      if (filter.category !== undefined) query.set('category', filter.category);
      return mapPage(await request('GET', `${endpoints.list}?${query}`, undefined, signal));
    },
    markRead: post(endpoints.markRead),
    markUnread: post(endpoints.markUnread),
    async markAllRead() {
      await request('POST', endpoints.markAllRead);
    },
    archive: post(endpoints.archive),
    unarchive: post(endpoints.unarchive),
    remove: post(endpoints.remove),
    async unreadCount() {
      const json = (await request('GET', endpoints.unreadCount)) as { count?: number } | number;
      return typeof json === 'number' ? json : (json?.count ?? 0);
    },
  };
}
