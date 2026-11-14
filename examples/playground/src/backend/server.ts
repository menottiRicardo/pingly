import { memoryAdapter, type Envelope, type InboxNotification, type MemoryAdapter } from 'pingly';
import { chaos } from './chaos';
import { describeEvent } from './describe';
import type { AppEvents, EventType } from './events';
import { seedNotifications } from './seed';

type Wire = Envelope<AppEvents> & { id: string; createdAt: string };

export interface ReceivedMessage {
  at: number;
  data: unknown;
}

/**
 * An in-browser stand-in for a real backend. It owns the notification
 * "database" and speaks three real protocols, so the library's WebSocket,
 * SSE and polling transports run their actual code paths.
 */
export class FakeServer {
  db: MemoryAdapter<InboxNotification['title'], unknown> = memoryAdapter(seedNotifications());
  private readonly log: Wire[] = [];
  private readonly sockets = new Set<FakeSocket>();
  private readonly streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  private readonly messageListeners = new Set<(m: ReceivedMessage) => void>();
  private seq = 0;

  /** Store an event and push it to every open connection. */
  publish<K extends EventType>(type: K, payload: AppEvents[K]): Wire {
    const event = {
      type,
      payload,
      id: `evt-${Date.now()}-${++this.seq}`,
      createdAt: new Date().toISOString(),
    } as Wire;
    this.log.push(event);
    if (this.log.length > 500) this.log.shift();
    this.db.push({
      ...describeEvent(type, payload),
      id: event.id,
      type,
      createdAt: event.createdAt,
      payload,
    });
    const json = JSON.stringify(event);
    for (const socket of this.sockets) socket.deliver(json);
    const frame = new TextEncoder().encode(`id: ${event.id}\ndata: ${json}\n\n`);
    for (const stream of this.streams) stream.enqueue(frame);
    return event;
  }

  /** Kill every open connection, like a server restart. */
  dropConnections() {
    for (const socket of [...this.sockets]) socket.serverClose(1006, 'Server went away');
    for (const stream of [...this.streams]) {
      try {
        stream.error(new TypeError('network error'));
      } catch {
        // Already closed.
      }
    }
    this.streams.clear();
  }

  /** Throw away all notifications and start again from the seed. */
  resetData() {
    this.db = memoryAdapter(seedNotifications());
    this.log.length = 0;
  }

  get openConnections() {
    return this.sockets.size + this.streams.size;
  }

  onMessage(listener: (m: ReceivedMessage) => void) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  /** Events after `id`, used for resuming and polling. */
  since(id: string | null): Wire[] {
    if (!id) return [];
    const index = this.log.findIndex((e) => e.id === id);
    return index === -1 ? [] : this.log.slice(index + 1);
  }

  get lastEventId(): string | null {
    return this.log[this.log.length - 1]?.id ?? null;
  }

  /** `WebSocket` implementation to pass to `websocketTransport`. */
  readonly WebSocket = socketClassFor(this);

  /** `fetch` implementation for `sseTransport` (text/event-stream). */
  readonly fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const { latency, offline } = chaos.get();
    await new Promise((r) => setTimeout(r, latency));
    if (offline) throw new TypeError('Failed to fetch');
    const resumeFrom = new Headers(init?.headers).get('Last-Event-ID');
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
        this.streams.add(c);
        const encoder = new TextEncoder();
        c.enqueue(encoder.encode(': connected\n\n'));
        for (const e of this.since(resumeFrom))
          c.enqueue(encoder.encode(`id: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`));
      },
      cancel: () => {
        this.streams.delete(controller);
      },
    });
    init?.signal?.addEventListener('abort', () => {
      this.streams.delete(controller);
      try {
        controller.close();
      } catch {
        // Already closed.
      }
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;

  /** Poll handler for `pollingTransport`. */
  readonly poll = async ({ cursor }: { cursor: string | null }) => {
    const { latency, offline } = chaos.get();
    await new Promise((r) => setTimeout(r, latency));
    if (offline) throw new TypeError('Failed to fetch');
    return { events: this.since(cursor ?? null), cursor: this.lastEventId ?? cursor };
  };

  register(socket: FakeSocket) {
    this.sockets.add(socket);
  }

  unregister(socket: FakeSocket) {
    this.sockets.delete(socket);
  }

  receive(data: unknown) {
    const message = { at: Date.now(), data };
    for (const listener of [...this.messageListeners]) listener(message);
  }
}

/** A `WebSocket` constructor whose sockets connect to `server`. */
function socketClassFor(server: FakeServer): typeof WebSocket {
  return class extends FakeSocket {
    constructor(url: string | URL) {
      super(server, String(url));
    }
  } as unknown as typeof WebSocket;
}

/** Behaves like a browser WebSocket connected to the fake server. */
class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = 0;
  binaryType: BinaryType = 'blob';
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  constructor(
    private readonly server: FakeServer,
    readonly url: string,
  ) {
    const { latency, offline } = chaos.get();
    setTimeout(() => {
      if (this.readyState === 3) return;
      if (offline) {
        this.readyState = 3;
        this.onerror?.(new Event('error'));
        this.onclose?.(new CloseEvent('close', { code: 1006, reason: 'Connection refused' }));
        return;
      }
      this.readyState = 1;
      server.register(this);
      this.onopen?.(new Event('open'));
      const resume = new URL(url).searchParams.get('lastEventId');
      for (const e of server.since(resume)) this.deliver(JSON.stringify(e));
    }, latency);
  }

  send(data: string) {
    if (this.readyState !== 1) throw new DOMException('WebSocket is not open', 'InvalidStateError');
    const message = JSON.parse(data) as { type?: string; payload?: unknown };
    if (message.type === 'ping') {
      setTimeout(() => this.deliver(JSON.stringify({ type: 'pong' })), chaos.get().latency);
      return;
    }
    this.server.receive(message);
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.server.unregister(this);
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  deliver(data: string) {
    if (this.readyState === 1) this.onmessage?.(new MessageEvent('message', { data }));
  }

  serverClose(code: number, reason: string) {
    this.close(code, reason);
  }
}

export const server = new FakeServer();
