# Changelog

## 1.0.0

pingly grows from toasts into a complete notifications toolkit.

### Toasts

- Stacked deck that expands on hover or focus
- Swipe to dismiss toward the nearest screen edge
- Time-left progress bar that pauses with the toaster
- Rich colors, icon overrides, `toast.custom()`, `unstyled` and `classNames`
- Multiple toasters with `toasterId`, each with its own limit
- `dedupeKey` shows a repeat counter instead of stacking
- Focus hotkey (Alt+T by default)
- `useToastsPaused()` hook

### Notification center (new)

- Inbox store with cursor pagination, filters, optimistic read/unread/archive/delete with rollback, grouping and cross-tab sync
- `memoryAdapter` and `restAdapter`
- `NotificationBell`, `NotificationPopover`, `Inbox`, `NotificationList`, `NotificationItem`, `InboxTabs`, `UnreadBadge`
- `NotificationProvider` and hooks (`useInbox`, `useNotifications`, `useUnreadCount`, …)

### Realtime (new)

- `createNotificationClient` typed from one event map, with reconnect backoff, resume, dedupe, validation, offline queue and offline/hidden-tab handling
- WebSocket (auth, heartbeat), SSE (EventSource or fetch stream) and polling transports
- Routes that turn events into inbox notifications and toasts
- `ConnectionStatus`, `useConnectionStatus`, `useNotificationEvent`

### Banners & alerts (new)

- `banner.show()` with priority, scheduling and remembered dismissal; `BannerHost`, `Banner`, `Alert`

### Browser (new)

- OS notifications, permission helpers and `PermissionPrompt`
- Unread count in the tab title and favicon, notification sound

### Preferences (new)

- Categories × channels with locks and mutes, time-zone aware quiet hours
- Memory, localStorage and REST adapters; `NotificationPreferences` UI
- Enforced by the provider before every delivery

### Testing (new)

- `pingly/testing`: mock transport, fixtures, mock inbox adapter, `resetPingly()`

### Other

- Subpath entry points per area and per-area stylesheets
- Shared theme tokens and `light` / `dark` / `system` themes across all components

## 0.1.0

Initial release.

- `toast()` with `success`, `error`, `info`, `warning` and `loading` variants
- `toast.promise()` for async flows
- `toast.update()` and `toast.dismiss()` by id
- `<Toaster>` with six positions, max visible toasts, light/dark/system themes
- Pause on hover, focus and window blur
- Action and close buttons, Escape to dismiss
- `useToasts()` hook for custom rendering
- Default stylesheet driven by CSS variables, respects `prefers-reduced-motion`
