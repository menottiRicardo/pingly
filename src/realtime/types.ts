import type { DateInput } from '../shared/time';

/** Map of event type → payload type, declared once per app. */
export type EventMap = Record<string, unknown>;

/** One event on the wire, after parsing. */
export type Envelope<E extends EventMap = EventMap> = {
  [K in keyof E & string]: {
    type: K;
    payload: E[K];
    /** Unique id; used to drop duplicates and resume after reconnects. */
    id?: string;
    createdAt?: DateInput;
  };
}[keyof E & string];

export type ConnectionStatus =
  'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline' | 'paused' | 'closed';

export interface CloseInfo {
  code?: number;
  reason?: string;
}

/** Callbacks a transport reports to. */
export interface TransportHandlers {
  onOpen(): void;
  onMessage(raw: unknown): void;
  onClose(info?: CloseInfo): void;
  onError(error: unknown): void;
}

export interface TransportContext {
  /** Id of the last event received, for resuming. */
  lastEventId: string | null;
  /** 0 for the first connection, then 1, 2… for reconnects. */
  attempt: number;
}

/** A single live connection. */
export interface TransportConnection {
  /** Send data to the server. Returns `false` if this transport can't send. */
  send(data: unknown): boolean;
  close(): void;
}

/**
 * Opens one connection. The client calls it again for every reconnect, so
 * transports never need their own retry logic.
 */
export type Transport = (
  handlers: TransportHandlers,
  context: TransportContext,
) => TransportConnection | Promise<TransportConnection>;

/**
 * Anything that delivers typed events. Every `NotificationClient<E, Out>`
 * satisfies it, whatever its outgoing message types.
 */
export interface EventFeed<E extends EventMap> {
  onAny(handler: (envelope: Envelope<E>) => void): () => void;
  /** Type-only marker that lets TypeScript infer the event map. Never set at runtime. */
  readonly '~events'?: E;
}

/** The part of a client that status UIs need; any typed client satisfies it. */
export interface ConnectionSource {
  subscribe(listener: () => void): () => void;
  getStatus(): ConnectionStatus;
  reconnect(): void;
}
