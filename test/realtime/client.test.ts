import { backoffDelay } from '../../src/realtime/backoff';
import { createNotificationClient } from '../../src/realtime/client';
import { createSSEParser } from '../../src/realtime/sse-parser';
import { pollingTransport } from '../../src/realtime/transports/polling';
import { sseTransport } from '../../src/realtime/transports/sse';
import { websocketTransport } from '../../src/realtime/transports/websocket';
import { FakeWebSocket, manualTransport } from './helpers';

type Events = {
  'invoice.paid': { invoiceId: string; amount: number };
  'comment.created': { postId: string; text: string };
};
type Outgoing = { 'presence.update': { online: boolean } };

describe('backoffDelay', () => {
  it('grows exponentially within jitter bounds and caps at max', () => {
    expect(backoffDelay(0, { jitter: 'none' })).toBe(500);
    expect(backoffDelay(3, { jitter: 'none' })).toBe(4000);
    expect(backoffDelay(20, { jitter: 'none' })).toBe(30_000);
    expect(backoffDelay(2, { random: () => 0 })).toBe(1000);
    expect(backoffDelay(2, { random: () => 1 })).toBe(2000);
    expect(backoffDelay(2, { jitter: 'full', random: () => 0 })).toBe(0);
  });
});

describe('createSSEParser', () => {
  it('parses events across chunk boundaries', () => {
    const out: unknown[] = [];
    const parser = createSSEParser((m) => out.push(m));
    parser.push('id: 1\nevent: notify\ndata: {"a"');
    parser.push(':1}\n\n: comment\ndata: line1\ndata: line2\n\n');
    expect(out).toEqual([
      { event: 'notify', data: '{"a":1}', id: '1', retry: undefined },
      { event: 'message', data: 'line1\nline2', id: '1', retry: undefined },
    ]);
  });
});

describe('NotificationClient', () => {
  beforeEach(() => vi.useFakeTimers());

  it('delivers typed events and tracks status', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events>({ transport: t.transport });
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    expect(client.getStatus()).toBe('connecting');
    t.current.handlers.onOpen();
    expect(client.getStatus()).toBe('open');

    const paid = vi.fn();
    client.on('invoice.paid', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ invoiceId: string; amount: number }>();
      paid(payload.amount);
    });
    const any = vi.fn();
    client.onAny(any);
    t.current.handlers.onMessage({
      type: 'invoice.paid',
      payload: { invoiceId: 'i1', amount: 42 },
      id: 'e1',
    });
    t.current.handlers.onMessage([
      { type: 'comment.created', payload: { postId: 'p', text: 'hi' } },
      'junk',
    ]);
    expect(paid).toHaveBeenCalledWith(42);
    expect(any).toHaveBeenCalledTimes(2);
    expect(client.lastEventId).toBe('e1');
    client.destroy();
  });

  it('drops duplicate event ids', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events>({ transport: t.transport });
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    const handler = vi.fn();
    client.on('invoice.paid', handler);
    const event = { type: 'invoice.paid', payload: { invoiceId: 'i', amount: 1 }, id: 'dup' };
    t.current.handlers.onMessage(event);
    t.current.handlers.onMessage(event);
    expect(handler).toHaveBeenCalledTimes(1);
    client.destroy();
  });

  it('rejects payloads that fail validation', async () => {
    const t = manualTransport();
    const onError = vi.fn();
    const client = createNotificationClient<Events>({
      transport: t.transport,
      validate: {
        'invoice.paid': (p): p is Events['invoice.paid'] =>
          typeof (p as { amount?: unknown }).amount === 'number',
      },
    });
    client.onError(onError);
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    const handler = vi.fn();
    client.on('invoice.paid', handler);
    t.current.handlers.onMessage({ type: 'invoice.paid', payload: { amount: 'lots' } });
    expect(handler).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ reason: 'validation' }));
    client.destroy();
  });

  it('reconnects with backoff and resumes from the last event id', async () => {
    const t = manualTransport();
    const statuses: string[] = [];
    const client = createNotificationClient<Events>({
      transport: t.transport,
      reconnect: { initial: 1000, jitter: 'none' },
    });
    client.onStatus((s) => statuses.push(s));
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    t.current.handlers.onOpen();
    t.current.handlers.onMessage({
      type: 'invoice.paid',
      payload: { invoiceId: 'a', amount: 1 },
      id: 'last',
    });
    t.current.handlers.onClose({ code: 1006 });
    expect(client.getStatus()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(999);
    expect(t.connections).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.connections).toHaveLength(2);
    expect(t.current.lastEventId).toBe('last');
    t.current.handlers.onClose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.connections).toHaveLength(3);
    t.current.handlers.onOpen();
    expect(statuses).toEqual(['open', 'reconnecting', 'open']);
    client.destroy();
  });

  it('gives up after maxAttempts', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events>({
      transport: t.transport,
      reconnect: { maxAttempts: 1, initial: 10, jitter: 'none' },
    });
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    t.current.handlers.onClose();
    await vi.advanceTimersByTimeAsync(10);
    t.current.handlers.onClose();
    expect(client.getStatus()).toBe('closed');
    client.destroy();
  });

  it('queues sends while disconnected and flushes on open', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events, Outgoing>({ transport: t.transport });
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    expect(client.send('presence.update', { online: true })).toBe(false);
    t.current.handlers.onOpen();
    expect(t.current.sent).toEqual([{ type: 'presence.update', payload: { online: true } }]);
    expect(client.send('presence.update', { online: false })).toBe(true);
    client.destroy();
  });

  it('goes offline and back online with the browser', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events>({ transport: t.transport });
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    t.current.handlers.onOpen();
    window.dispatchEvent(new Event('offline'));
    expect(client.getStatus()).toBe('offline');
    expect(t.connections[0]!.closed).toBe(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(t.connections).toHaveLength(2));
    client.destroy();
  });

  it('stays closed after disconnect', async () => {
    const t = manualTransport();
    const client = createNotificationClient<Events>({ transport: t.transport, autoConnect: false });
    expect(client.getStatus()).toBe('idle');
    client.connect();
    await vi.waitFor(() => expect(t.connections).toHaveLength(1));
    client.disconnect();
    expect(client.getStatus()).toBe('closed');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.connections).toHaveLength(1);
    client.destroy();
  });
});

describe('websocketTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
  });

  it('adds the auth token, parses JSON and sends heartbeats', async () => {
    const client = createNotificationClient<Events>({
      transport: websocketTransport({
        url: 'wss://rt.test/socket',
        auth: async () => 'tok',
        heartbeat: {
          interval: 1000,
          timeout: 500,
          isPong: (m) => (m as { type?: string }).type === 'pong',
        },
        WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      }),
    });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const ws = FakeWebSocket.instances[0]!;
    expect(ws.url).toBe('wss://rt.test/socket?token=tok');
    ws.open();
    const handler = vi.fn();
    client.on('comment.created', handler);
    ws.receive({ type: 'comment.created', payload: { postId: 'p', text: 'yo' } });
    ws.receive({ type: 'pong' });
    expect(handler).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(ws.sent).toEqual(['{"type":"ping"}']);
    client.destroy();
  });

  it('reconnects when the heartbeat goes quiet', async () => {
    const client = createNotificationClient<Events>({
      transport: websocketTransport({
        url: 'wss://rt.test/socket',
        heartbeat: { interval: 1000, timeout: 500 },
        WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      }),
      reconnect: { initial: 100, jitter: 'none' },
    });
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    FakeWebSocket.instances[0]!.open();
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.getStatus()).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(100);
    expect(FakeWebSocket.instances).toHaveLength(2);
    client.destroy();
  });
});

describe('sseTransport', () => {
  it('listens to named events through EventSource', async () => {
    const sources: FakeEventSource[] = [];
    class FakeEventSource {
      listeners: Record<string, (e: MessageEvent) => void> = {};
      onopen: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      constructor(public url: string) {
        sources.push(this);
      }
      addEventListener(name: string, fn: (e: MessageEvent) => void) {
        this.listeners[name] = fn;
      }
      close() {}
    }
    const client = createNotificationClient<Events>({
      transport: sseTransport({
        url: 'https://rt.test/stream',
        events: ['notify'],
        EventSource: FakeEventSource as unknown as typeof EventSource,
      }),
    });
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    sources[0]!.onopen?.();
    expect(client.getStatus()).toBe('open');
    const handler = vi.fn();
    client.onAny(handler);
    sources[0]!.listeners.notify!({
      data: JSON.stringify({ type: 'invoice.paid', payload: { invoiceId: 'x', amount: 3 } }),
      type: 'notify',
      lastEventId: '9',
    } as MessageEvent);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'invoice.paid', id: '9' }),
    );
    expect(client.lastEventId).toBe('9');
    client.destroy();
  });

  it('streams with fetch when headers are needed', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'id: 5\ndata: {"type":"comment.created","payload":{"postId":"p","text":"t"}}\n\n',
          ),
        );
        controller.close();
      },
    });
    const fetch = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(body, { status: 200 }),
    );
    const handler = vi.fn();
    const client = createNotificationClient<Events>({
      transport: sseTransport({
        url: 'https://rt.test/stream',
        headers: { Authorization: 'Bearer x' },
        fetch: fetch as unknown as typeof globalThis.fetch,
      }),
      reconnect: false,
    });
    client.on('comment.created', handler);
    await vi.waitFor(() =>
      expect(handler).toHaveBeenCalledWith({ postId: 'p', text: 't' }, expect.anything()),
    );
    const init = fetch.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer x');
    client.destroy();
  });
});

describe('pollingTransport', () => {
  beforeEach(() => vi.useFakeTimers());

  it('polls with a cursor and delivers events', async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce({
        events: [{ type: 'invoice.paid', payload: { invoiceId: 'a', amount: 1 } }],
        cursor: 'c1',
      })
      .mockResolvedValue({ events: [], cursor: 'c1' });
    const handler = vi.fn();
    const client = createNotificationClient<Events>({
      transport: pollingTransport({ poll, interval: 1000 }),
    });
    client.on('invoice.paid', handler);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(client.getStatus()).toBe('open');
    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'c1' }));
    client.destroy();
  });
});
