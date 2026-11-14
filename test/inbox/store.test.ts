import { memoryAdapter, restAdapter } from '../../src/inbox/adapters';
import { minutesAgo } from './fixtures';
import { groupNotifications } from '../../src/inbox/grouping';
import { InboxStore } from '../../src/inbox/store';
import type { InboxAdapter } from '../../src/inbox/types';
import { make } from './fixtures';

const seed = () => Array.from({ length: 5 }, (_, i) => make(String(i + 1)));

describe('InboxStore', () => {
  it('loads the first page newest first and paginates', async () => {
    const inbox = new InboxStore({ adapter: memoryAdapter(seed()), pageSize: 2 });
    await inbox.load();
    expect(inbox.getVisible().map((n) => n.id)).toEqual(['1', '2']);
    expect(inbox.getSnapshot()).toMatchObject({ status: 'ready', hasMore: true });
    await inbox.loadMore();
    await inbox.loadMore();
    expect(inbox.getVisible().map((n) => n.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(inbox.getSnapshot().hasMore).toBe(false);
  });

  it('keeps selector results stable between unrelated reads', async () => {
    const inbox = new InboxStore({ adapter: memoryAdapter(seed()) });
    await inbox.load();
    expect(inbox.getVisible()).toBe(inbox.getVisible());
  });

  it('filters by status and category', async () => {
    const adapter = memoryAdapter([
      make('1', { readAt: minutesAgo(0) }),
      make('2', { category: 'billing' }),
      make('3', { archivedAt: minutesAgo(0) }),
    ]);
    const inbox = new InboxStore({ adapter });
    await inbox.setFilter({ status: 'unread' });
    expect(inbox.getVisible().map((n) => n.id)).toEqual(['2']);
    await inbox.setFilter({ status: 'archived' });
    expect(inbox.getVisible().map((n) => n.id)).toEqual(['3']);
    await inbox.setFilter({ category: 'billing' });
    expect(inbox.getVisible().map((n) => n.id)).toEqual(['2']);
  });

  it('receives new notifications, bumps the count and emits once per new item', async () => {
    const inbox = new InboxStore({ adapter: memoryAdapter(seed()) });
    await inbox.load();
    expect(inbox.getUnreadCount()).toBe(5);
    const received = vi.fn();
    inbox.events.on('received', received);
    inbox.receive(make('new', { createdAt: new Date().toISOString() }));
    inbox.receive(make('new', { createdAt: new Date().toISOString() }));
    expect(received).toHaveBeenCalledTimes(1);
    expect(inbox.getUnreadCount()).toBe(6);
    expect(inbox.getVisible()[0]!.id).toBe('new');
    expect(inbox.getSnapshot().lastReceivedAt).not.toBeNull();
  });

  it('marks read optimistically and calls the adapter', async () => {
    const adapter = memoryAdapter(seed());
    const inbox = new InboxStore({ adapter });
    await inbox.load();
    const pending = inbox.markRead(['1', '2']);
    expect(inbox.getUnreadCount()).toBe(3);
    await pending;
    expect(
      adapter.items
        .filter((n) => n.readAt)
        .map((n) => n.id)
        .sort(),
    ).toEqual(['1', '2']);
    await inbox.markAllRead();
    expect(inbox.getUnreadCount()).toBe(0);
    await inbox.markUnread('3');
    expect(inbox.getUnreadCount()).toBe(1);
  });

  it('rolls back and reports when the adapter fails', async () => {
    const base = memoryAdapter(seed());
    const adapter: InboxAdapter<string> = {
      ...base,
      archive: () => Promise.reject(new Error('nope')),
    };
    const inbox = new InboxStore({ adapter });
    await inbox.load();
    const onError = vi.fn();
    inbox.events.on('error', onError);
    const pending = inbox.archive('1');
    expect(inbox.getVisible().map((n) => n.id)).not.toContain('1');
    await pending;
    expect(inbox.getVisible().map((n) => n.id)).toContain('1');
    expect(inbox.getUnreadCount()).toBe(5);
    expect(onError).toHaveBeenCalledWith({ action: 'archive', error: expect.any(Error) });
  });

  it('removes notifications', async () => {
    const inbox = new InboxStore({ adapter: memoryAdapter(seed()) });
    await inbox.load();
    await inbox.remove(['1', '5']);
    expect(inbox.getVisible().map((n) => n.id)).toEqual(['2', '3', '4']);
    expect(inbox.getUnreadCount()).toBe(3);
  });

  it('derives the unread count without a backend number', async () => {
    const adapter: InboxAdapter<string> = { list: async () => ({ items: seed() }) };
    const inbox = new InboxStore({ adapter });
    await inbox.load();
    expect(inbox.getSnapshot().serverUnread).toBeNull();
    expect(inbox.getUnreadCount()).toBe(5);
    await inbox.markRead('1');
    expect(inbox.getUnreadCount()).toBe(4);
  });

  it('reports load errors', async () => {
    const inbox = new InboxStore<string>({
      adapter: { list: () => Promise.reject(new Error('down')) },
    });
    await inbox.load();
    expect(inbox.getSnapshot().status).toBe('error');
  });

  it('ignores responses from a superseded load', async () => {
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    const adapter: InboxAdapter<string> = {
      list: async ({ filter }) => {
        if (filter.status === 'unread') await slow;
        return { items: [make(filter.status === 'unread' ? 'old' : 'fresh')] };
      },
    };
    const inbox = new InboxStore({ adapter });
    const first = inbox.setFilter({ status: 'unread' });
    await inbox.setFilter({ status: 'all' });
    release();
    await first;
    expect(Object.keys(inbox.getSnapshot().items)).toEqual(['fresh']);
  });

  it('shares changes with other tabs', async () => {
    const name = `test-${Math.random()}`;
    const a = new InboxStore({ adapter: memoryAdapter(seed()), syncTabs: name });
    const b = new InboxStore({ adapter: memoryAdapter(seed()), syncTabs: name });
    await Promise.all([a.load(), b.load()]);
    await a.markRead('1');
    await vi.waitFor(() => expect(b.get('1')?.readAt).toBeTruthy());
    a.destroy();
    b.destroy();
  });
});

describe('groupNotifications', () => {
  it('collapses notifications that share a groupKey', () => {
    const groups = groupNotifications([
      make('1', { groupKey: 'post-1' }),
      make('2'),
      make('3', { groupKey: 'post-1' }),
    ]);
    expect(groups.map((g) => g.items.map((n) => n.id))).toEqual([['1', '3'], ['2']]);
  });
});

describe('restAdapter', () => {
  it('sends filters, ids and headers', async () => {
    const calls: Array<[string, RequestInit]> = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(
        JSON.stringify(
          url.includes('unread-count') ? { count: 7 } : { items: [], nextCursor: 'c2' },
        ),
      );
    });
    const adapter = restAdapter({
      baseUrl: 'https://api.test/',
      headers: async () => ({ Authorization: 'Bearer t' }),
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const page = await adapter.list({
      cursor: 'c1',
      filter: { status: 'unread', category: 'x' },
      limit: 10,
    });
    expect(page.nextCursor).toBe('c2');
    expect(calls[0]![0]).toBe(
      'https://api.test/notifications?limit=10&status=unread&cursor=c1&category=x',
    );
    expect(new Headers(calls[0]![1].headers).get('Authorization')).toBe('Bearer t');
    await adapter.markRead(['a', 'b']);
    expect(calls[1]![1]).toMatchObject({ method: 'POST', body: '{"ids":["a","b"]}' });
    expect(await adapter.unreadCount()).toBe(7);
  });

  it('throws HttpError on failures', async () => {
    const fetch = async () => new Response('{"error":"bad"}', { status: 500 });
    const adapter = restAdapter({
      baseUrl: 'https://api.test',
      fetch: fetch as typeof globalThis.fetch,
    });
    await expect(adapter.markAllRead()).rejects.toMatchObject({ name: 'HttpError', status: 500 });
  });
});
