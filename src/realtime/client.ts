import { Emitter } from '../shared/emitter';
import { hasDom } from '../shared/env';
import { backoffDelay, type BackoffOptions } from './backoff';
import type {
  CloseInfo,
  ConnectionStatus,
  Envelope,
  EventMap,
  Transport,
  TransportConnection,
} from './types';

export interface ReconnectOptions extends BackoffOptions {
  /** Give up after this many failed attempts in a row. Defaults to `Infinity`. */
  maxAttempts?: number;
}

export type Validators<E extends EventMap> = {
  [K in keyof E]?: (payload: unknown) => payload is E[K];
};

export interface NotificationClientOptions<In extends EventMap, Out extends EventMap> {
  transport: Transport;
  /**
   * Turn raw transport data into envelopes. Defaults to accepting objects
   * shaped like `{ type, payload, id?, createdAt? }` (or arrays of them).
   */
  parse?: (raw: unknown) => Envelope<In> | Envelope<In>[] | null | undefined;
  /** Shape outgoing messages. Defaults to `{ type, payload }`. */
  serialize?: (message: Envelope<Out>) => unknown;
  /** Runtime checks per event type; failing events are dropped and reported. */
  validate?: Validators<In>;
  /** `false` disables reconnecting. */
  reconnect?: ReconnectOptions | false;
  /** Connect immediately. Defaults to `true`. */
  autoConnect?: boolean;
  /** Disconnect while the tab is hidden, reconnect when visible. Defaults to `false`. */
  pauseWhenHidden?: boolean;
  /** How many recent event ids to remember for dropping duplicates. Defaults to `500`. */
  dedupeWindow?: number;
  /** Queue `send()` calls while disconnected (up to this many). `0` disables. Defaults to `100`. */
  queueSize?: number;
}

export interface ClientEvents<In extends EventMap> {
  event: Envelope<In>;
  status: ConnectionStatus;
  /** The transport closed (before any reconnect attempt). */
  close: CloseInfo;
  error: { error: unknown; raw?: unknown; reason: 'transport' | 'parse' | 'validation' };
}

type Handler<P, E> = (payload: P, envelope: E) => void;

function defaultParse(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.filter(isEnvelope);
  return isEnvelope(raw) ? raw : null;
}

function isEnvelope(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/** A typed realtime connection that reconnects on its own. */
export class NotificationClient<In extends EventMap = EventMap, Out extends EventMap = EventMap> {
  private readonly emitter = new Emitter<ClientEvents<In>>();
  private readonly typed = new Map<string, Set<Handler<unknown, Envelope<In>>>>();
  private readonly listeners = new Set<() => void>();
  private readonly options: NotificationClientOptions<In, Out>;
  private readonly seen: string[] = [];
  private readonly seenSet = new Set<string>();
  private readonly queue: unknown[] = [];
  private status: ConnectionStatus = 'idle';
  private connection: TransportConnection | null = null;
  private generation = 0;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private wanted = false;
  private cleanupEnv: (() => void) | null = null;
  /** Id of the last event received. Sent to transports for resuming. */
  lastEventId: string | null = null;

  constructor(options: NotificationClientOptions<In, Out>) {
    this.options = options;
    if (options.autoConnect !== false) this.connect();
  }

  getStatus = (): ConnectionStatus => this.status;

  /** Subscribe to status changes (for `useSyncExternalStore`). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Listen to one event type with a fully typed payload. */
  on<K extends keyof In & string>(
    type: K,
    handler: Handler<In[K], Extract<Envelope<In>, { type: K }>>,
  ): () => void {
    let set = this.typed.get(type);
    if (!set) this.typed.set(type, (set = new Set()));
    set.add(handler as Handler<unknown, Envelope<In>>);
    return () => this.off(type, handler);
  }

  once<K extends keyof In & string>(
    type: K,
    handler: Handler<In[K], Extract<Envelope<In>, { type: K }>>,
  ): () => void {
    const off = this.on(type, (payload, envelope) => {
      off();
      handler(payload, envelope);
    });
    return off;
  }

  off<K extends keyof In & string>(
    type: K,
    handler: Handler<In[K], Extract<Envelope<In>, { type: K }>>,
  ): void {
    this.typed.get(type)?.delete(handler as Handler<unknown, Envelope<In>>);
  }

  /** Listen to every event. */
  onAny(handler: (envelope: Envelope<In>) => void): () => void {
    return this.emitter.on('event', handler);
  }

  onStatus(handler: (status: ConnectionStatus) => void): () => void {
    return this.emitter.on('status', handler);
  }

  onError(handler: (error: ClientEvents<In>['error']) => void): () => void {
    return this.emitter.on('error', handler);
  }

  /** Send a typed message. Queued while disconnected; returns whether it was sent now. */
  send<K extends keyof Out & string>(type: K, payload: Out[K]): boolean {
    const message = { type, payload } as Envelope<Out>;
    const data = this.options.serialize ? this.options.serialize(message) : message;
    if (this.status === 'open' && this.connection?.send(data)) return true;
    const max = this.options.queueSize ?? 100;
    if (max > 0) {
      this.queue.push(data);
      if (this.queue.length > max) this.queue.shift();
    }
    return false;
  }

  connect(): void {
    this.wanted = true;
    this.bindEnvironment();
    if (this.connection || this.status === 'connecting' || this.status === 'reconnecting') return;
    this.attempt = 0;
    void this.open();
  }

  /** Close the connection and stop reconnecting. */
  disconnect(): void {
    this.wanted = false;
    this.teardown();
    this.cleanupEnv?.();
    this.cleanupEnv = null;
    this.setStatus('closed');
  }

  /** Drop the current connection and open a fresh one. */
  reconnect(): void {
    this.teardown();
    this.wanted = true;
    this.attempt = 0;
    void this.open();
  }

  /** Disconnect and remove every listener. */
  destroy(): void {
    this.disconnect();
    this.emitter.clear();
    this.typed.clear();
    this.listeners.clear();
  }

  /** Feed a raw message as if it came from the transport (handy for tests and SSR hydration). */
  inject(raw: unknown): void {
    this.handleMessage(raw);
  }

  private teardown() {
    this.generation++;
    clearTimeout(this.retryTimer);
    const conn = this.connection;
    this.connection = null;
    conn?.close();
  }

  private async open() {
    if (!this.wanted) return;
    if (hasDom() && navigator.onLine === false) {
      this.setStatus('offline');
      return;
    }
    if (this.options.pauseWhenHidden && hasDom() && document.visibilityState === 'hidden') {
      this.setStatus('paused');
      return;
    }
    const generation = ++this.generation;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const live = () => generation === this.generation;
    try {
      const connection = await this.options.transport(
        {
          onOpen: () => {
            if (!live()) return;
            this.attempt = 0;
            this.setStatus('open');
            this.flush();
          },
          onMessage: (raw) => {
            if (live()) this.handleMessage(raw);
          },
          onClose: (info?: CloseInfo) => {
            if (!live()) return;
            this.connection = null;
            this.emitter.emit('close', info ?? {});
            this.scheduleReconnect();
          },
          onError: (error) => {
            if (live()) this.emitter.emit('error', { error, reason: 'transport' });
          },
        },
        { lastEventId: this.lastEventId, attempt: this.attempt },
      );
      if (!live()) {
        connection.close();
        return;
      }
      this.connection = connection;
    } catch (error) {
      if (!live()) return;
      this.emitter.emit('error', { error, reason: 'transport' });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    const options = this.options.reconnect;
    if (!this.wanted || options === false) {
      this.setStatus('closed');
      return;
    }
    if (this.attempt >= (options?.maxAttempts ?? Infinity)) {
      this.wanted = false;
      this.setStatus('closed');
      return;
    }
    const delay = backoffDelay(this.attempt, options);
    this.attempt++;
    this.setStatus('reconnecting');
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.open(), delay);
  }

  private flush() {
    while (this.queue.length && this.connection) {
      if (!this.connection.send(this.queue[0])) break;
      this.queue.shift();
    }
  }

  private handleMessage(raw: unknown) {
    let parsed: unknown;
    try {
      parsed = this.options.parse ? this.options.parse(raw) : defaultParse(raw);
    } catch (error) {
      this.emitter.emit('error', { error, raw, reason: 'parse' });
      return;
    }
    if (parsed == null) return;
    const list = (Array.isArray(parsed) ? parsed : [parsed]) as Envelope<In>[];
    for (const envelope of list) this.deliver(envelope, raw);
  }

  private deliver(envelope: Envelope<In>, raw: unknown) {
    const validator = this.options.validate?.[envelope.type];
    if (validator && !validator(envelope.payload)) {
      this.emitter.emit('error', {
        error: new Error(`Invalid payload for "${envelope.type}"`),
        raw,
        reason: 'validation',
      });
      return;
    }
    if (envelope.id !== undefined) {
      if (this.seenSet.has(envelope.id)) return;
      this.remember(envelope.id);
      this.lastEventId = envelope.id;
    }
    for (const handler of [...(this.typed.get(envelope.type) ?? [])]) {
      try {
        handler(envelope.payload, envelope);
      } catch (error) {
        queueMicrotask(() => {
          throw error;
        });
      }
    }
    this.emitter.emit('event', envelope);
  }

  private remember(id: string) {
    const max = this.options.dedupeWindow ?? 500;
    this.seen.push(id);
    this.seenSet.add(id);
    while (this.seen.length > max) this.seenSet.delete(this.seen.shift()!);
  }

  private setStatus(status: ConnectionStatus) {
    if (status === this.status) return;
    this.status = status;
    this.emitter.emit('status', status);
    for (const listener of [...this.listeners]) listener();
  }

  /** React to the browser going offline/online and the tab being hidden/shown. */
  private bindEnvironment() {
    if (this.cleanupEnv || !hasDom()) return;
    const onOffline = () => {
      this.teardown();
      this.setStatus('offline');
    };
    const onOnline = () => {
      if (!this.wanted) return;
      this.attempt = 0;
      void this.open();
    };
    const onVisibility = () => {
      if (!this.options.pauseWhenHidden || !this.wanted) return;
      if (document.visibilityState === 'hidden') {
        this.teardown();
        this.setStatus('paused');
      } else if (!this.connection) {
        this.attempt = 0;
        void this.open();
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanupEnv = () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }
}

/** Create a typed realtime client. `In` = server → client events, `Out` = client → server. */
export function createNotificationClient<In extends EventMap, Out extends EventMap = EventMap>(
  options: NotificationClientOptions<In, Out>,
): NotificationClient<In, Out> {
  return new NotificationClient<In, Out>(options);
}
