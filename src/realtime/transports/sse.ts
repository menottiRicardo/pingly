import { createSSEParser } from '../sse-parser';
import type { Transport, TransportContext, TransportHandlers } from '../types';

type MaybePromise<T> = T | Promise<T>;

export interface SSETransportOptions {
  url: string | ((context: TransportContext) => MaybePromise<string>);
  /** Named events to listen to besides the default `message` event. */
  events?: string[];
  withCredentials?: boolean;
  /**
   * Headers for the request (e.g. `Authorization`). When set, the stream is
   * read with `fetch` because `EventSource` can't send headers.
   */
  headers?: HeadersInit | (() => MaybePromise<HeadersInit>);
  /** Add `lastEventId` to the URL when reconnecting. Defaults to `true`. */
  resume?: boolean;
  /** Decode each event's data. Defaults to `JSON.parse`, falling back to the raw string. */
  deserialize?: (data: string, event: string) => unknown;
  EventSource?: typeof EventSource;
  fetch?: typeof fetch;
}

const defaultDeserialize = (data: string) => {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

/** Server-Sent Events. Receive-only: `send` returns `false`. */
export function sseTransport(options: SSETransportOptions): Transport {
  return async (handlers, context) => {
    const base = typeof options.url === 'function' ? await options.url(context) : options.url;
    const url = new URL(base, typeof location === 'undefined' ? undefined : location.href);
    if (options.resume !== false && context.lastEventId)
      url.searchParams.set('lastEventId', context.lastEventId);
    const deserialize = options.deserialize ?? defaultDeserialize;
    return options.headers
      ? fetchStream(url.toString(), options, handlers, deserialize, context)
      : eventSource(url.toString(), options, handlers, deserialize);
  };
}

function eventSource(
  url: string,
  options: SSETransportOptions,
  handlers: TransportHandlers,
  deserialize: (data: string, event: string) => unknown,
) {
  const Source = options.EventSource ?? globalThis.EventSource;
  if (!Source) throw new Error('pingly: EventSource is not available in this environment.');
  const source = new Source(url, { withCredentials: options.withCredentials });
  let closed = false;
  const listener = (event: MessageEvent) =>
    handlers.onMessage(withId(deserialize(event.data, event.type), event.lastEventId));
  for (const name of ['message', ...(options.events ?? [])])
    source.addEventListener(name, listener as EventListener);
  source.onopen = () => handlers.onOpen();
  source.onerror = (error) => {
    // Let the client own retries so backoff and status stay consistent.
    if (closed) return;
    closed = true;
    source.close();
    handlers.onError(error);
    handlers.onClose();
  };
  return {
    send: () => false,
    close() {
      closed = true;
      source.close();
    },
  };
}

async function fetchStream(
  url: string,
  options: SSETransportOptions,
  handlers: TransportHandlers,
  deserialize: (data: string, event: string) => unknown,
  context: TransportContext,
) {
  const controller = new AbortController();
  const headers = new Headers(
    typeof options.headers === 'function' ? await options.headers() : options.headers,
  );
  headers.set('Accept', 'text/event-stream');
  if (context.lastEventId) headers.set('Last-Event-ID', context.lastEventId);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    handlers.onClose();
  };
  const wanted = new Set(['message', ...(options.events ?? [])]);
  const parser = createSSEParser((m) => {
    if (wanted.has(m.event)) handlers.onMessage(withId(deserialize(m.data, m.event), m.id));
  });

  (async () => {
    try {
      const res = await (options.fetch ?? fetch)(url, {
        headers,
        signal: controller.signal,
        credentials: options.withCredentials ? 'include' : 'same-origin',
      });
      if (!res.ok || !res.body) throw new Error(`Stream failed with status ${res.status}`);
      handlers.onOpen();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(value);
      }
      parser.end();
    } catch (error) {
      if (!controller.signal.aborted) handlers.onError(error);
    }
    if (!controller.signal.aborted) finish();
  })();

  return {
    send: () => false,
    close() {
      closed = true;
      controller.abort();
    },
  };
}

/** Attach the SSE event id to object payloads that don't carry their own. */
function withId(data: unknown, id: string | undefined) {
  if (!id || typeof data !== 'object' || data === null || 'id' in data) return data;
  return { ...data, id };
}
