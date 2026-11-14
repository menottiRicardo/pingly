# Browser notifications

## Through the provider

```tsx
<NotificationProvider
  inbox={inbox}
  systemNotifications // OS notifications for new items while the tab is hidden
  sound // short chime (or { src: '/ding.mp3', volume: 0.5 })
  documentBadge // "(3) My app" in the tab title; { favicon: true } draws on the icon too
>
  <PermissionPrompt />
</NotificationProvider>
```

OS notifications use the notification's title and body when they are plain text, and focus the tab on click. Preferences and quiet hours are respected.

## Permission

`<PermissionPrompt />` explains why before triggering the browser prompt, hides once permission is decided, and remembers "Not now" (`storageKey`, or `false` to always show).

`usePermission()` returns `{ permission, request }` for your own UI. Permission is `'default' | 'granted' | 'denied' | 'unsupported'`.

## Plain functions

```ts
import {
  createFaviconBadge,
  createSound,
  createTitleBadge,
  notify,
  requestPermission,
} from 'pingly/browser';

await requestPermission(); // call from a click
await notify({ title: 'New message', body: 'Ana: hi!', tag: 'chat-1', onlyWhenHidden: true });

const title = createTitleBadge();
title.set(3); // "(3) Inbox"

const favicon = createFaviconBadge({ color: '#2563eb' });
favicon.set(3);

const sound = createSound();
await sound.play(); // false if the browser blocked audio
```

Pass `registration` (a service worker registration) to `notify` where the page can't create notifications directly, such as some mobile browsers.

`useDocumentBadge(count, { title, favicon })` keeps both in sync with any number.
