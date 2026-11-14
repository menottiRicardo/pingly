# pingly

Lightweight, accessible toast notifications for React.

- Tiny API: call `toast()` from anywhere, no context or hooks required
- Success, error, info, warning, loading and promise toasts
- Accessible: live region, `role="alert"` for errors, keyboard dismiss
- Pauses on hover, focus and when the window is in the background
- Queues toasts beyond a configurable limit
- Themeable with CSS variables, light/dark/system, respects reduced motion
- Written in TypeScript, ships ESM + CJS, works with React 18 and 19

## Install

```bash
npm install pingly
# or
pnpm add pingly
# or
yarn add pingly
```

## Quick start

Render a `<Toaster />` once, import the stylesheet, then call `toast()` anywhere.

```tsx
import { Toaster, toast } from 'pingly';
import 'pingly/styles.css';

export function App() {
  return (
    <>
      <button onClick={() => toast.success('Saved!')}>Save</button>
      <Toaster />
    </>
  );
}
```

## `toast()`

```ts
toast('Event created');
toast.success('Profile updated', { description: 'Your changes are live.' });
toast.error('Upload failed');
toast.info('New version available');
toast.warning('Storage almost full');
const id = toast.loading('Uploading…');
```

Every call returns the toast's `id`.

### Options

| Option        | Type                                       | Default     | Description                                                   |
| ------------- | ------------------------------------------ | ----------- | ------------------------------------------------------------- |
| `id`          | `string`                                   | auto        | Reuse an id to update an existing toast.                      |
| `type`        | `'default' \| 'success' \| 'error' \| ...` | `'default'` | Visual style and icon.                                        |
| `description` | `ReactNode`                                | –           | Secondary text below the title.                               |
| `duration`    | `number`                                   | Toaster's   | Milliseconds before auto-dismiss. `Infinity` keeps it open.   |
| `action`      | `{ label: ReactNode; onClick(event) }`     | –           | Adds a button. Call `event.preventDefault()` to keep it open. |
| `dismissible` | `boolean`                                  | `true`      | Allow close button and Escape key.                            |
| `className`   | `string`                                   | –           | Extra class on the toast element.                             |
| `onDismiss`   | `(toast) => void`                          | –           | Called when dismissed by the user or code.                    |
| `onAutoClose` | `(toast) => void`                          | –           | Called when the duration runs out.                            |

Loading toasts stay open until updated or dismissed.

### Promises

```ts
toast.promise(saveSettings(), {
  loading: 'Saving…',
  success: (result) => `Saved ${result.name}`,
  error: (err) => `Could not save: ${(err as Error).message}`,
});
```

`toast.promise` returns the original promise, so you can still `await` it.

### Update and dismiss

```ts
const id = toast.loading('Uploading…');
toast.update(id, { type: 'success', title: 'Uploaded' });

toast.dismiss(id); // one
toast.dismiss(); // all
```

### Actions

```ts
toast('Message archived', {
  action: { label: 'Undo', onClick: () => restoreMessage() },
});
```

### Custom content

Titles and descriptions accept any React node:

```tsx
toast(
  <span>
    Invited <strong>Ana</strong> to the project
  </span>,
);
```

## `<Toaster />`

| Prop          | Type                                | Default           | Description                              |
| ------------- | ----------------------------------- | ----------------- | ---------------------------------------- |
| `position`    | `'top-left' \| 'top-center' \| ...` | `'bottom-right'`  | One of six screen positions.             |
| `duration`    | `number`                            | `4000`            | Default auto-dismiss time in ms.         |
| `max`         | `number`                            | `3`               | Toasts shown at once; extras are queued. |
| `gap`         | `number`                            | `12`              | Space between toasts in px.              |
| `offset`      | `number \| string`                  | `24`              | Distance from the viewport edge.         |
| `closeButton` | `boolean`                           | `false`           | Show a close button on each toast.       |
| `theme`       | `'light' \| 'dark' \| 'system'`     | `'light'`         | Color scheme.                            |
| `label`       | `string`                            | `'Notifications'` | Accessible name of the region.           |
| `className`   | `string`                            | –                 | Extra class on the container.            |
| `style`       | `CSSProperties`                     | –                 | Inline styles on the container.          |

## Styling

All styles live in `pingly/styles.css` and are driven by CSS variables, so you
can theme everything without fighting specificity:

```css
.pingly-toaster {
  --pingly-bg: #0f172a;
  --pingly-fg: #f8fafc;
  --pingly-border: #1e293b;
  --pingly-radius: 14px;
  --pingly-width: 400px;
  --pingly-success: #22c55e;
}
```

Toast elements expose `data-type` and `data-state` (`visible` / `leaving`)
attributes for targeted styling:

```css
.pingly-toast[data-type='error'] {
  border-left: 4px solid var(--pingly-error);
}
```

Prefer your own styles entirely? Skip the stylesheet import and style the
`pingly-*` classes yourself, or build your own renderer with `useToasts()`.

## `useToasts()`

Returns the current list of toasts (including queued ones and those leaving),
for building a completely custom UI:

```tsx
import { useToasts, toast } from 'pingly';

function MyToasts() {
  const toasts = useToasts();
  return (
    <ul>
      {toasts.map((t) => (
        <li key={t.id} onClick={() => toast.dismiss(t.id)}>
          {t.title}
        </li>
      ))}
    </ul>
  );
}
```

## Accessibility

- The container is a labelled `region` with a polite live list.
- Error toasts use `role="alert"`; everything else uses `role="status"`.
- Press <kbd>Escape</kbd> while focused inside a toast to dismiss it.
- Timers pause while the pointer or keyboard focus is inside the toaster.
- Animations are reduced when `prefers-reduced-motion` is set.

## Server rendering

The bundle is marked with `"use client"`, so `<Toaster />` can be dropped into
a Next.js App Router layout directly.

## Development

```bash
pnpm install
pnpm test       # run tests
pnpm build      # build to dist/
pnpm example    # run the demo app
```

## License

[MIT](./LICENSE)
