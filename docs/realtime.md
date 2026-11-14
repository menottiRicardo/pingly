# Typed realtime

Declare your event types once; the client, routes and hooks are all typed from that map.

```ts
type AppEvents = {
  'comment.created': { postId: string; author: string; text: string };
  'invoice.paid': { invoiceId: string; amount: number };
};

type ClientMessages = {
  'presence.update': { online: boolean };
};

const client = createNotificationClient<AppEvents, ClientMessages>({
  transport: websocketTransport({ url: 'wss://api.example.com/live' }),
});

client.on('invoice.paid', (payload, envelope) => {
  payload.amount; // number
});
client.send('presence.update', { online: true });
```

## Creating the client

Create the client once, outside your components, and it connects right away. If it depends on component state (a user id, a chosen transport), turn off `autoConnect` and connect in an effect, so clients React creates and discards never open a connection:

```tsx
const client = useMemo(
  () => createNotificationClient<AppEvents>({ transport, autoConnect: false }),
  [transport],
);
useEffect(() => {
  client.connect();
  return () => client.disconnect();
}, [client]);
```

Clients that also declare outgoing messages (`createNotificationClient<In, Out>`) work everywhere a client is accepted.

## Wire format

By default each message is `{ type, payload, id?, createdAt? }` (or an array of them). Use `parse` for anything else:

```ts
createNotificationClient<AppEvents>({
  transport,
  parse: (raw) => ({ type: raw.event, payload: raw.data, id: raw.uuid }),
});
```

`id` is used to drop duplicates and to resume after a reconnect (`lastEventId`).

## Client options

| Option               | Default                                                    | Description                                                           |
| -------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `transport`          | —                                                          | `websocketTransport`, `sseTransport`, `pollingTransport` or your own. |
| `parse`, `serialize` |                                                            | Map wire formats in and out.                                          |
| `validate`           |                                                            | Per-type runtime guards; failing events are dropped and reported.     |
| `reconnect`          | `{ initial: 500, max: 30000, factor: 2, jitter: 'equal' }` | Backoff; `false` disables. `maxAttempts` gives up.                    |
| `autoConnect`        | `true`                                                     | Connect immediately.                                                  |
| `pauseWhenHidden`    | `false`                                                    | Disconnect while the tab is hidden.                                   |
| `dedupeWindow`       | `500`                                                      | Recent ids remembered for dedupe.                                     |
| `queueSize`          | `100`                                                      | `send()` calls queued while offline.                                  |

The client also reacts to the browser going offline/online.

### Members

`on`, `once`, `off`, `onAny`, `onStatus`, `onError`, `send`, `connect`, `disconnect`, `reconnect`, `destroy`, `getStatus()`, `lastEventId`.

Statuses: `idle`, `connecting`, `open`, `reconnecting`, `offline`, `paused`, `closed`.

## Transports

### `websocketTransport`

| Option                                                             | Description                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `url`                                                              | String or `(context) => string` (async allowed).                                                    |
| `auth`                                                             | `() => token`; added as `?token=` on every (re)connect. `authParam` renames it.                     |
| `heartbeat`                                                        | `{ interval, timeout, message, isPong }` — reconnects when the socket goes quiet. `false` disables. |
| `resume`                                                           | Add `lastEventId` to the URL on reconnect (default `true`).                                         |
| `protocols`, `binaryType`, `serialize`, `deserialize`, `WebSocket` | Low-level control.                                                                                  |

### `sseTransport`

Uses `EventSource`, or streams with `fetch` when you pass `headers` (e.g. `Authorization`). `events` lists named events to listen to. Receive-only.

### `pollingTransport`

```ts
pollingTransport({
  interval: 15_000,
  poll: async ({ cursor, signal }) => {
    const res = await fetch(`/api/events?since=${cursor ?? ''}`, { signal });
    const { events, cursor: next } = await res.json();
    return { events, cursor: next };
  },
});
```

### Your own

A transport is a function that opens one connection and reports back; the client handles retries.

```ts
const transport: Transport = (handlers, { lastEventId, attempt }) => {
  const conn = openSomething();
  conn.onopen = handlers.onOpen;
  conn.onmessage = (m) => handlers.onMessage(m);
  conn.onclose = () => handlers.onClose();
  return { send: (data) => conn.write(data), close: () => conn.close() };
};
```

## Routes: events → inbox and toasts

```tsx
const routes = defineRoutes(client, {
  'comment.created': {
    notification: (p) => ({ title: `${p.author} commented`, body: p.text, category: 'comments', groupKey: `post-${p.postId}` }),
    toast: (p) => ({ title: `${p.author} commented` }),
  },
});

<NotificationProvider client={client} routes={routes} shouldDeliver={(envelope, channel) => true}>
```

- `notification` returns the inbox entry; `id`, `type`, `createdAt` and `payload` are filled from the event.
- `toast` returns toast options plus `title`; return `null` to skip.
- Events without a route are stored when their payload already looks like a notification (has a `title`).
- Preferences (if provided) are checked before each delivery.

Outside React, use `bridgeEvents(client, { inbox, routes, onToast })`.

## Hooks and components

- `useNotificationEvent('invoice.paid', handler)` — subscribe inside a component.
- `useConnectionStatus()` — current status.
- `useNotificationClient()` — the provider's client.
- `<ConnectionStatus />` — live/offline indicator with an optional Retry button.
