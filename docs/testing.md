# Testing

`pingly/testing` lets your own tests drive notifications without a server.

## A fake server

```ts
import { createNotificationClient } from 'pingly';
import { createMockTransport } from 'pingly/testing';

const server = createMockTransport<AppEvents>();
const client = createNotificationClient<AppEvents>({ transport: server.transport });

server.emit('invoice.paid', { invoiceId: 'INV-1', amount: 40 }, { id: 'e1' });
server.simulateDisconnect(); // client starts reconnecting
server.sent; // what the client sent
server.connections; // how many times it connected
server.lastEventId; // resume id on the latest connection
```

Pass `{ autoOpen: false }` to control exactly when the connection opens with `server.open()`.

## Fixtures

```ts
import { createMockInboxAdapter, fakeNotification, fakeNotifications } from 'pingly/testing';

const adapter = createMockInboxAdapter(fakeNotifications(5), { fail: { archive: true } });
const inbox = createInbox({ adapter });

adapter.calls; // [{ method: 'list', args: [...] }, ...]
adapter.fail.archive = false;
```

## Resetting global state

Toasts and banners live in shared stores. Clear them between tests:

```ts
import { resetPingly } from 'pingly/testing';

afterEach(() => resetPingly());
```
