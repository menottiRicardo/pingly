import type { Transport, TransportHandlers } from '../../src/realtime/types';

/** A transport whose connections the test drives by hand. */
export function manualTransport() {
  const connections: Array<{
    handlers: TransportHandlers;
    sent: unknown[];
    closed: boolean;
    lastEventId: string | null;
  }> = [];
  const transport: Transport = (handlers, ctx) => {
    const conn = { handlers, sent: [] as unknown[], closed: false, lastEventId: ctx.lastEventId };
    connections.push(conn);
    return {
      send: (data) => {
        conn.sent.push(data);
        return true;
      },
      close: () => {
        conn.closed = true;
      },
    };
  };
  return {
    transport,
    connections,
    get current() {
      return connections[connections.length - 1]!;
    },
  };
}

/** Minimal WebSocket stand-in. */
export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  binaryType = 'blob';
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
