# Notification center

A persistent list of notifications with read state, plus the UI to browse it: a bell with an unread badge, a popover feed, and a full-page inbox.

## Setup

```tsx
import { NotificationBell, NotificationProvider, createInbox, restAdapter } from 'pingly';

const inbox = createInbox({
  adapter: restAdapter({ baseUrl: '/api' }),
  pageSize: 20,
  syncTabs: true,
});

<NotificationProvider inbox={inbox}>
  <NotificationBell />
</NotificationProvider>;
```

Without an `inbox`, the provider creates an in-memory one.

## Notification shape

```ts
interface Notification {
  id: string;
  type: string; // your own kind, e.g. 'comment.created'
  title: ReactNode;
  body?: ReactNode;
  createdAt: string | number | Date;
  readAt?: string | number | Date | null;
  archivedAt?: string | number | Date | null;
  category?: string; // tabs + preferences
  avatar?: string; // image URL
  url?: string; // where clicking goes
  actions?: { id: string; label: ReactNode; variant?: 'primary' | 'secondary' | 'danger' }[];
  groupKey?: string; // collapse related notifications
  payload?: unknown; // anything else you need
}
```

## Adapters

An adapter connects the inbox to your storage. Only `list` is required; every other method is optional and the inbox updates optimistically, rolling back if a call fails.

```ts
interface InboxAdapter {
  list(params: {
    cursor: string | null;
    filter: { status?: 'all' | 'unread' | 'archived'; category?: string };
    limit: number;
    signal?: AbortSignal;
  }): Promise<{ items: Notification[]; nextCursor?: string | null; unreadCount?: number }>;
  markRead?(ids: string[]): Promise<void>;
  markUnread?(ids: string[]): Promise<void>;
  markAllRead?(): Promise<void>;
  archive?(ids: string[]): Promise<void>;
  unarchive?(ids: string[]): Promise<void>;
  remove?(ids: string[]): Promise<void>;
  unreadCount?(): Promise<number>;
}
```

### `restAdapter(options)`

| Option                 | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `baseUrl`              | API root.                                                       |
| `headers`              | Object or (async) function, e.g. for a fresh token.             |
| `endpoints`            | Override any path (defaults below).                             |
| `mapPage(json)`        | Map your list response to `{ items, nextCursor, unreadCount }`. |
| `credentials`, `fetch` | Passed to fetch.                                                |

Default endpoints: `GET /notifications?cursor&limit&status&category`, `POST /notifications/read|unread|archive|unarchive|delete` with `{ ids }`, `POST /notifications/read-all`, `GET /notifications/unread-count` → `{ count }`.

### `memoryAdapter(seed?, { latency? })`

Keeps everything in memory — useful for prototypes, demos and tests.

## Store

`createInbox()` returns an `InboxStore`:

| Member                                                                    | Description                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `load(filter?)`, `loadMore()`, `setFilter(filter)`                        | Fetching and pagination.                             |
| `receive(notification \| notification[])`                                 | Add new arrivals (rings the bell, emits `received`). |
| `upsert(...)`                                                             | Insert or replace without "new" semantics.           |
| `markRead`, `markUnread`, `markAllRead`, `archive`, `unarchive`, `remove` | Optimistic actions.                                  |
| `getVisible()`, `getUnreadCount()`, `get(id)`, `getSnapshot()`            | Reading state.                                       |
| `events.on('received' \| 'error', fn)`                                    | Arrivals and rolled-back failures.                   |
| `destroy()`                                                               | Stop tab sync and pending requests.                  |

With `syncTabs`, read/archive/delete changes are shared between open tabs through `BroadcastChannel`.

## Components

### `<NotificationBell />`

A bell button with an unread badge that opens `<NotificationPopover>`. Accepts every popover prop plus:

| Prop                                  | Description                                 |
| ------------------------------------- | ------------------------------------------- |
| `open`, `defaultOpen`, `onOpenChange` | Controlled or uncontrolled.                 |
| `max`                                 | Badge shows `max+` above this (default 99). |
| `dot`                                 | Show a dot instead of a number.             |
| `ring`                                | Wiggle on new arrivals (default `true`).    |
| `icon`                                | Replace the bell.                           |

### `<NotificationPopover />`

| Prop                                                            | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `tabs`                                                          | `{ id, label, filter }[]` or `false`. Defaults to All / Unread. |
| `onNavigate(notification, event)`                               | Called on click (prevents the link default so you can route).   |
| `onAction(actionId, notification)`                              | Notification action buttons.                                    |
| `onSettings`                                                    | Shows a settings button in the header.                          |
| `renderItem(notification, grouped)`                             | Replace the item.                                               |
| `groupByDay`                                                    | "Today / Yesterday / date" headings (default `true`).           |
| `placement`, `width`, `footer`, `emptyState`, `labels`, `theme` | Layout and copy.                                                |

The popover traps focus, closes on Escape or outside click, and returns focus to the bell. Arrow keys move between items.

### `<Inbox />`

Full-page version with All / Unread / Archived tabs and bulk select (mark read/unread, archive, delete).

### `<NotificationList />`, `<NotificationItem />`, `<InboxTabs />`, `<UnreadBadge />`

The building blocks, for composing your own layout.

## Hooks

- `useInbox()` — notifications, unread count, status, filter and bound actions.
- `useNotifications()`, `useUnreadCount()`, `useNotification(id)`, `useInboxState()`, `useInboxStore()`.

## Labels

Every component takes `labels` to translate or reword text. Dates and relative times use `Intl` with the provider's `locale`.
