# Preferences

Let people choose what they hear about and where, and have every delivery respect it.

```tsx
import { NotificationPreferences, createPreferences, restPreferences } from 'pingly';

const preferences = createPreferences({
  categories: [
    { id: 'comments', label: 'Comments', description: 'Replies on your posts' },
    { id: 'security', label: 'Security', locked: ['email'] },
    { id: 'marketing', label: 'Product news', channels: ['email'] },
  ],
  channels: [
    { id: 'inApp', label: 'In-app' },
    { id: 'browser', label: 'Desktop' },
    { id: 'email', label: 'Email' },
  ],
  adapter: restPreferences({ url: '/api/me/notification-preferences' }),
});

<NotificationProvider preferences={preferences}>
  <NotificationPreferences store={preferences} />
</NotificationProvider>;
```

## Model

- **Categories × channels** — each switch is `values.channels[category][channel]`; missing means enabled.
- **`channels` on a category** — only those apply (others show "–").
- **`locked`** — always on (e.g. security email).
- **Mute** — silences a category everywhere except locked channels.
- **Quiet hours** — `{ enabled, start: '22:00', end: '08:00', timeZone?, days? }`. Overnight ranges work, and early-morning hours count toward the previous night's day.

## Enforcement

The provider checks preferences before every delivery:

| Delivery               | Channel (configurable via `preferenceChannels`) | Held during quiet hours |
| ---------------------- | ----------------------------------------------- | ----------------------- |
| Inbox                  | `inApp`                                         | no                      |
| Toast                  | `inApp`                                         | yes                     |
| OS notification, sound | `browser`                                       | yes                     |

Your own code can call `preferences.allows(category, channel, { interruptive: true })`.

## Store

`load()`, `set(category, channel, enabled)`, `mute(category, muted)`, `setQuietHours(patch)`, `reset()`, `save()`, `isEnabled()`, `isQuiet()`, `allows()`.

Changes auto-save after `saveDelay` ms (default 600); pass `autoSave: false` to save with the button instead.

## Adapters

`memoryPreferences()`, `localPreferences(key?)`, `restPreferences({ url, headers })` (GET to load, PUT to save), or any `{ load, save }` object.
