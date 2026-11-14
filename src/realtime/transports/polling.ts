import type { Transport } from '../types';

export interface PollResult {
  /** Events received since the last poll. */
  events: unknown[];
  /** Cursor passed back on the next poll. */
  cursor?: string | null;
}

export interface PollingTransportOptions {
  /**
   * Fetch new events. Receives the cursor from the previous poll (or the
   * last event id after a reconnect).
   */
  poll: (args: { cursor: string | null; signal: AbortSignal }) => Promise<PollResult>;
  /** Time between polls in ms. Defaults to `15000`. */
  interval?: number;
  /** Optional sender for client → server messages. */
  send?: (data: unknown) => void;
}

/** Poll an endpoint on an interval. The simplest way to get near-realtime updates. */
export function pollingTransport({
  poll,
  interval = 15_000,
  send,
}: PollingTransportOptions): Transport {
  return (handlers, context) => {
    const controller = new AbortController();
    let cursor = context.lastEventId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let opened = false;
    let closed = false;

    const tick = async () => {
      try {
        const result = await poll({ cursor, signal: controller.signal });
        if (closed) return;
        if (!opened) {
          opened = true;
          handlers.onOpen();
        }
        if (result.cursor !== undefined) cursor = result.cursor;
        for (const event of result.events) handlers.onMessage(event);
        timer = setTimeout(tick, interval);
      } catch (error) {
        if (closed) return;
        closed = true;
        handlers.onError(error);
        handlers.onClose();
      }
    };
    void tick();

    return {
      send(data) {
        if (!send) return false;
        send(data);
        return true;
      },
      close() {
        closed = true;
        clearTimeout(timer);
        controller.abort();
      },
    };
  };
}
