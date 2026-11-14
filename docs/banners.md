# Banners & alerts

## Banners

Page-level announcements. Render a host and show banners from anywhere:

```tsx
import { BannerHost, banner } from 'pingly';

<BannerHost />; // in your layout

banner.info('Scheduled maintenance Sunday 02:00 UTC', {
  startsAt: '2026-06-20T00:00:00Z',
  endsAt: '2026-06-21T04:00:00Z',
});
banner.error('Your card was declined', {
  priority: 10,
  action: { label: 'Update card', onClick: openBilling },
});
banner.success('We use cookies to keep you signed in.', { dismissKey: 'cookies-v1' });
```

| Option                          | Description                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `variant`                       | `info`, `success`, `warning`, `error`, `neutral`.                                       |
| `description`, `icon`, `action` | Content. `action.href` renders a link.                                                  |
| `priority`                      | Highest shows first (then newest).                                                      |
| `startsAt`, `endsAt`            | Schedule; the host updates on its own.                                                  |
| `dismissible`                   | Default `true`.                                                                         |
| `dismissKey`                    | Remember dismissal in localStorage so it never returns. `banner.forget(key)` resets it. |
| `hostId`                        | Target `<BannerHost id="…">`.                                                           |
| `onDismiss`                     | Callback.                                                                               |

`<BannerHost>` props: `id`, `max` (default 1), `fixed`, `position` (`top`/`bottom`), `theme`, `dismissLabel`.

Use `<Banner>` directly for a static banner.

## Alerts

Inline callouts inside the page:

```tsx
<Alert variant="warning" title="Unusual sign-in" actions={<button>Review</button>}>
  We noticed a sign-in from a new device.
</Alert>
```

Errors and warnings use `role="alert"`, others `role="status"`. Pass `role="none"` for static content that shouldn't be announced.
