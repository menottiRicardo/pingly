# pingly

Everything notifications for React: toasts, a notification center with a bell, typed realtime delivery, banners, browser notifications and user preferences — in one small, accessible, dependency-free package.

- **Toasts** — `toast()` from anywhere, promise toasts, stacking, swipe to dismiss, progress bars, dedupe.
- **Notification center** — a bell with unread badge, a popover feed with tabs and day groups, and a full-page inbox with bulk actions.
- **Typed realtime** — declare your events once and get autocomplete from the socket to the UI. WebSocket, SSE and polling, with reconnects, resume and dedupe built in.
- **Banners & alerts** — page announcements with priority, scheduling and remembered dismissal, plus inline alerts.
- **Browser** — OS notifications, a friendly permission prompt, unread count in the tab title and favicon, and a notification sound.
- **Preferences** — categories × channels, mutes and time-zone aware quiet hours, enforced before every delivery.
- **Testing** — a mock transport and fixtures so your own tests never need a server.

Zero runtime dependencies. Works with React 18 and 19, ships ESM + CJS with types, and is marked `"use client"` so it drops straight into React Server Components apps.

## Install

```bash
npm install pingly
```

## Quick start

```tsx
import { NotificationBell, NotificationProvider, Toaster, toast } from 'pingly';
import 'pingly/styles.css';

export function App() {
  return (
    <NotificationProvider>
      <header>
        <NotificationBell />
      </header>
      <button onClick={() => toast.success('Saved!')}>Save</button>
      <Toaster />
    </NotificationProvider>
  );
}
```

## Toasts

```ts
toast('Event created');
toast.success('Profile updated', { description: 'Your changes are live.' });
toast.error('Upload failed', { action: { label: 'Retry', onClick: retry } });

toast.promise(saveSettings(), {
  loading: 'Saving…',
  success: (result) => `Saved ${result.name}`,
  error: 'Could not save',
});

const id = toast.loading('Uploading…');
toast.update(id, { type: 'success', title: 'Uploaded' });
toast.dismiss(id);
```

```tsx
<Toaster position="top-center" stacked richColors progress closeButton />
```

→ [Toast guide](./docs/toast.md)

## Notification center

Connect an inbox to your API, then drop in a bell:

```tsx
import { NotificationBell, NotificationProvider, createInbox, restAdapter } from 'pingly';

const inbox = createInbox({
  adapter: restAdapter({
    baseUrl: '/api',
    headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  }),
  syncTabs: true,
});

<NotificationProvider inbox={inbox}>
  <NotificationBell onNavigate={(n) => router.push(n.url!)} />
</NotificationProvider>;
```

Prefer a full page? Render `<Inbox />`. Building your own UI? Use `useInbox()`.

→ [Notification center guide](./docs/inbox.md)

## Typed realtime

```tsx
import {
  NotificationProvider,
  createNotificationClient,
  defineRoutes,
  websocketTransport,
} from 'pingly';

type AppEvents = {
  'comment.created': { postId: string; author: string; text: string };
  'invoice.paid': { invoiceId: string; amount: number };
};

const client = createNotificationClient<AppEvents>({
  transport: websocketTransport({ url: 'wss://api.example.com/live', auth: getToken }),
});

const routes = defineRoutes(client, {
  'comment.created': {
    notification: (p) => ({
      title: `${p.author} commented`,
      body: p.text,
      url: `/posts/${p.postId}`,
    }),
    toast: (p) => ({ title: `${p.author} commented` }),
  },
  'invoice.paid': {
    toast: (p) => ({ title: `Payment received: $${p.amount}`, type: 'success' }),
  },
});

<NotificationProvider client={client} routes={routes}>
  …
</NotificationProvider>;

client.on('invoice.paid', (payload) => payload.amount); // fully typed
```

→ [Realtime guide](./docs/realtime.md)

## Banners & alerts

```tsx
import { Alert, BannerHost, banner } from 'pingly';

<BannerHost />;
banner.warning('Scheduled maintenance tonight', { dismissKey: 'maint-2026-06' });

<Alert variant="error" title="Sync failed">
  We'll retry automatically.
</Alert>;
```

→ [Banners guide](./docs/banners.md)

## Browser notifications

```tsx
<NotificationProvider inbox={inbox} systemNotifications sound documentBadge>
  <PermissionPrompt />
</NotificationProvider>
```

→ [Browser guide](./docs/browser.md)

## Preferences

```tsx
import { NotificationPreferences, createPreferences, localPreferences } from 'pingly';

const preferences = createPreferences({
  categories: [
    { id: 'comments', label: 'Comments' },
    { id: 'security', label: 'Security', locked: ['email'] },
  ],
  channels: [
    { id: 'inApp', label: 'In-app' },
    { id: 'browser', label: 'Desktop' },
    { id: 'email', label: 'Email' },
  ],
  adapter: localPreferences(),
});

<NotificationProvider preferences={preferences}>
  <NotificationPreferences store={preferences} />
</NotificationProvider>;
```

→ [Preferences guide](./docs/preferences.md)

## Testing

```ts
import { createMockTransport, fakeNotifications, createMockInboxAdapter } from 'pingly/testing';

const server = createMockTransport<AppEvents>();
const client = createNotificationClient<AppEvents>({ transport: server.transport });
server.emit('invoice.paid', { invoiceId: 'INV-1', amount: 40 });
```

→ [Testing guide](./docs/testing.md)

## Importing only what you need

Everything is exported from `pingly`, and each area also has its own entry point:

| Import               | Contains                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `pingly/toast`       | `toast`, `Toaster`, hooks                                                                                |
| `pingly/inbox`       | inbox store, adapters, `NotificationBell`, `NotificationPopover`, `Inbox`, hooks, `NotificationProvider` |
| `pingly/realtime`    | typed client, transports, routes, `ConnectionStatus`, hooks                                              |
| `pingly/banner`      | `banner`, `BannerHost`, `Banner`, `Alert`                                                                |
| `pingly/browser`     | OS notifications, permission, title/favicon badges, sound                                                |
| `pingly/preferences` | preferences store, adapters, `NotificationPreferences`                                                   |
| `pingly/testing`     | mock transport, fixtures, `resetPingly`                                                                  |
| `pingly/styles.css`  | all styles (or `pingly/tokens.css` + `pingly/<area>.css`)                                                |

## Theming and accessibility

All components share CSS variables (`--pingly-bg`, `--pingly-accent`, …) and support `light`, `dark` and `system` themes. Every component is keyboard accessible, uses the right ARIA roles and respects `prefers-reduced-motion`. See [Theming](./docs/theming.md).

## Playground

```bash
pnpm install
pnpm example
```

Opens a demo app with every component on show. A fake backend speaks real WebSocket, SSE and polling, so the library's transports run for real, and a **Chaos** panel adds latency, random failures, an unreachable server, dropped connections and page crashes so you can watch rollbacks, retries, reconnects and resume.

## Development

```bash
pnpm test       # run tests
pnpm typecheck
pnpm lint
pnpm build      # build to dist/
```

## License

[MIT](./LICENSE)
