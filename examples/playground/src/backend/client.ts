import {
  createNotificationClient,
  pollingTransport,
  sseTransport,
  websocketTransport,
  type NotificationClient,
  type Transport,
} from 'pingly';
import type { AppEvents, ClientMessages } from './events';
import { server } from './server';

export type TransportKind = 'websocket' | 'sse' | 'polling';

export const TRANSPORTS: { id: TransportKind; label: string; description: string }[] = [
  { id: 'websocket', label: 'WebSocket', description: 'Two-way, token auth, heartbeat every 15s.' },
  {
    id: 'sse',
    label: 'Server-Sent Events',
    description: 'Streamed with fetch so it can send an Authorization header.',
  },
  { id: 'polling', label: 'Polling', description: 'Asks for new events every 3 seconds.' },
];

export type DemoClient = NotificationClient<AppEvents, ClientMessages>;

function transportFor(kind: TransportKind): Transport {
  switch (kind) {
    case 'websocket':
      return websocketTransport({
        url: 'wss://demo.pingly.local/live',
        auth: async () => `demo-token-${Date.now()}`,
        heartbeat: {
          interval: 15_000,
          timeout: 5_000,
          isPong: (m) => (m as { type?: string })?.type === 'pong',
        },
        WebSocket: server.WebSocket,
      });
    case 'sse':
      return sseTransport({
        url: 'https://demo.pingly.local/stream',
        headers: async () => ({ Authorization: 'Bearer demo-token' }),
        fetch: server.fetch,
      });
    case 'polling':
      return pollingTransport({ poll: server.poll, interval: 3_000 });
  }
}

export function createDemoClient(kind: TransportKind): DemoClient {
  return createNotificationClient<AppEvents, ClientMessages>({
    transport: transportFor(kind),
    // The component connects in an effect (and disconnects on cleanup), so a
    // client React creates and throws away never opens a connection.
    autoConnect: false,
    reconnect: { initial: 600, max: 8_000 },
    // Runtime checks catch a misbehaving server before bad data reaches the UI.
    validate: {
      'invoice.paid': (p): p is AppEvents['invoice.paid'] =>
        typeof (p as AppEvents['invoice.paid'])?.amount === 'number',
    },
  });
}
