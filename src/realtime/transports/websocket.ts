import type { Transport, TransportContext } from '../types';

type MaybePromise<T> = T | Promise<T>;

export interface HeartbeatOptions {
  /** How often to send a ping, in ms. Defaults to `25000`. */
  interval?: number;
  /** How long to wait for any message after a ping before reconnecting. Defaults to `10000`. */
  timeout?: number;
  /** What to send. Defaults to `{ type: 'ping' }`. */
  message?: unknown | (() => unknown);
  /** Recognise pong replies so they are not delivered as events. */
  isPong?: (raw: unknown) => boolean;
}

export interface WebSocketTransportOptions {
  /** Socket URL, or a function that builds it (e.g. with a fresh token). */
  url: string | ((context: TransportContext) => MaybePromise<string>);
  protocols?: string | string[];
  /**
   * Token added to the URL as `?token=…` on every (re)connect, since
   * browsers can't set headers on WebSockets.
   */
  auth?: () => MaybePromise<string | null | undefined>;
  /** Query parameter name for `auth`. Defaults to `token`. */
  authParam?: string;
  /** Add `lastEventId` to the URL when reconnecting. Defaults to `true`. */
  resume?: boolean;
  heartbeat?: HeartbeatOptions | false;
  binaryType?: BinaryType;
  /** Encode outgoing data. Defaults to `JSON.stringify` for non-strings. */
  serialize?: (data: unknown) => string | ArrayBufferLike | Blob | ArrayBufferView;
  /** Decode incoming data. Defaults to `JSON.parse` for strings. */
  deserialize?: (data: unknown) => unknown;
  /** WebSocket implementation, for tests or non-browser runtimes. */
  WebSocket?: typeof WebSocket;
}

const defaultDeserialize = (data: unknown) => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const defaultSerialize = (data: unknown) =>
  typeof data === 'string' ? data : JSON.stringify(data);

export function websocketTransport(options: WebSocketTransportOptions): Transport {
  return async (handlers, context) => {
    const Socket = options.WebSocket ?? globalThis.WebSocket;
    if (!Socket) throw new Error('pingly: WebSocket is not available in this environment.');
    const base = typeof options.url === 'function' ? await options.url(context) : options.url;
    const url = new URL(base, typeof location === 'undefined' ? undefined : location.href);
    if (options.auth) {
      const token = await options.auth();
      if (token) url.searchParams.set(options.authParam ?? 'token', token);
    }
    if (options.resume !== false && context.lastEventId) {
      url.searchParams.set('lastEventId', context.lastEventId);
    }

    const socket = new Socket(url.toString(), options.protocols);
    if (options.binaryType) socket.binaryType = options.binaryType;
    const serialize = options.serialize ?? defaultSerialize;
    const deserialize = options.deserialize ?? defaultDeserialize;
    const hb =
      options.heartbeat === false
        ? null
        : { interval: 25_000, timeout: 10_000, ...options.heartbeat };
    let lastSeen = Date.now();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;

    const finish = (info?: { code?: number; reason?: string }) => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      handlers.onClose(info);
    };

    socket.onopen = () => {
      lastSeen = Date.now();
      if (hb) {
        heartbeat = setInterval(() => {
          if (Date.now() - lastSeen > hb.interval + hb.timeout) {
            socket.close(4000, 'heartbeat timeout');
            finish({ code: 4000, reason: 'heartbeat timeout' });
            return;
          }
          const message =
            typeof hb.message === 'function' ? hb.message() : (hb.message ?? { type: 'ping' });
          try {
            socket.send(serialize(message) as string);
          } catch {
            // The close handler takes care of reconnecting.
          }
        }, hb.interval);
      }
      handlers.onOpen();
    };
    socket.onmessage = (event: MessageEvent) => {
      lastSeen = Date.now();
      const data = deserialize(event.data);
      if (hb?.isPong?.(data)) return;
      handlers.onMessage(data);
    };
    socket.onerror = (event) => handlers.onError(event);
    socket.onclose = (event: CloseEvent) => finish({ code: event.code, reason: event.reason });

    return {
      send(data) {
        if (socket.readyState !== 1) return false;
        socket.send(serialize(data) as string);
        return true;
      },
      close() {
        closed = true;
        clearInterval(heartbeat);
        socket.onclose = null;
        socket.close(1000);
      },
    };
  };
}
