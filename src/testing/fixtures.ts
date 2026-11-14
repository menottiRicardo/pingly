import { memoryAdapter, type MemoryAdapter } from '../inbox/adapters';
import type { Notification } from '../inbox/types';

let counter = 0;

/** A realistic notification with every required field filled in. */
export function fakeNotification<C = string, P = unknown>(
  overrides: Partial<Notification<C, P>> = {},
): Notification<C, P> {
  const n = ++counter;
  return {
    id: `fake-${n}`,
    type: 'test.event',
    title: `Notification ${n}` as C,
    body: `Details for notification ${n}` as C,
    createdAt: new Date(Date.now() - n * 60_000).toISOString(),
    readAt: null,
    ...overrides,
  };
}

/** `count` fake notifications, newest first. */
export function fakeNotifications<C = string, P = unknown>(
  count: number,
  overrides: Partial<Notification<C, P>> | ((index: number) => Partial<Notification<C, P>>) = {},
): Notification<C, P>[] {
  return Array.from({ length: count }, (_, i) =>
    fakeNotification<C, P>({
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
      ...(typeof overrides === 'function' ? overrides(i) : overrides),
    }),
  );
}

type Method =
  | 'list'
  | 'markRead'
  | 'markUnread'
  | 'markAllRead'
  | 'archive'
  | 'unarchive'
  | 'remove'
  | 'unreadCount';

export interface MockInboxAdapterOptions {
  /** Simulated network delay in ms. */
  latency?: number;
  /** Methods that should reject, e.g. `{ archive: true }`. */
  fail?: Partial<Record<Method, boolean | Error>>;
}

export interface MockInboxAdapter<C, P> extends MemoryAdapter<C, P> {
  /** Every call made, in order. */
  calls: Array<{ method: Method; args: unknown[] }>;
  /** Change which methods fail at any time. */
  fail: Partial<Record<Method, boolean | Error>>;
}

/** An in-memory adapter that records calls and can be told to fail. */
export function createMockInboxAdapter<C = string, P = unknown>(
  seed: Notification<C, P>[] = [],
  { latency = 0, fail = {} }: MockInboxAdapterOptions = {},
): MockInboxAdapter<C, P> {
  const base = memoryAdapter<C, P>(seed, { latency });
  const calls: MockInboxAdapter<C, P>['calls'] = [];
  const adapter = { calls, fail } as MockInboxAdapter<C, P>;
  const methods: Method[] = [
    'list',
    'markRead',
    'markUnread',
    'markAllRead',
    'archive',
    'unarchive',
    'remove',
    'unreadCount',
  ];
  for (const method of methods) {
    (adapter as unknown as Record<Method, (...args: unknown[]) => Promise<unknown>>)[method] =
      async (...args: unknown[]) => {
        calls.push({ method, args });
        const failure = adapter.fail[method];
        if (failure) throw failure instanceof Error ? failure : new Error(`Mock ${method} failed`);
        return (base[method] as (...a: unknown[]) => Promise<unknown>)(...args);
      };
  }
  Object.defineProperty(adapter, 'items', { get: () => base.items });
  adapter.push = (n) => base.push(n);
  return adapter;
}
