import type { CloseInfo, EventMap, Transport, TransportHandlers } from '../realtime/types';

export interface MockTransportOptions {
  /** Report the connection as open right away. Defaults to `true`. */
  autoOpen?: boolean;
}

export interface MockTransport<E extends EventMap> {
  /** Pass to `createNotificationClient({ transport })`. */
  transport: Transport;
  /** Push a typed event to the client. */
  emit<K extends keyof E & string>(
    type: K,
    payload: E[K],
    extra?: { id?: string; createdAt?: string | number },
  ): void;
  /** Push anything, exactly as a server would send it. */
  emitRaw(raw: unknown): void;
  /** Report the connection as open (when `autoOpen` is off). */
  open(): void;
  /** Drop the connection; the client will try to reconnect. */
  simulateDisconnect(info?: CloseInfo): void;
  /** Report a transport error. */
  simulateError(error?: unknown): void;
  /** Everything the client sent, oldest first. */
  readonly sent: unknown[];
  /** How many connections the client has opened. */
  readonly connections: number;
  /** `lastEventId` passed on the most recent connection. */
  readonly lastEventId: string | null;
}

/** A transport for tests and demos: you decide what the "server" sends. */
export function createMockTransport<E extends EventMap = EventMap>({
  autoOpen = true,
}: MockTransportOptions = {}): MockTransport<E> {
  let handlers: TransportHandlers | null = null;
  let connections = 0;
  let lastEventId: string | null = null;
  const sent: unknown[] = [];

  const transport: Transport = (h, context) => {
    handlers = h;
    connections++;
    lastEventId = context.lastEventId;
    if (autoOpen) queueMicrotask(() => handlers === h && h.onOpen());
    return {
      send(data) {
        sent.push(data);
        return true;
      },
      close() {
        if (handlers === h) handlers = null;
      },
    };
  };

  const current = () => {
    if (!handlers) throw new Error('pingly: the mock transport is not connected.');
    return handlers;
  };

  return {
    transport,
    emit(type, payload, extra) {
      current().onMessage({ type, payload, ...extra });
    },
    emitRaw(raw) {
      current().onMessage(raw);
    },
    open() {
      current().onOpen();
    },
    simulateDisconnect(info) {
      const h = current();
      handlers = null;
      h.onClose(info);
    },
    simulateError(error = new Error('Mock transport error')) {
      current().onError(error);
    },
    get sent() {
      return sent;
    },
    get connections() {
      return connections;
    },
    get lastEventId() {
      return lastEventId;
    },
  };
}
