# Toasts

Short-lived messages. Render one `<Toaster />` and call `toast()` from anywhere — components, event handlers, plain modules.

```tsx
import { Toaster, toast } from 'pingly';
import 'pingly/styles.css';

<Toaster />;
toast.success('Saved!');
```

## API

| Call                                                                | Description                                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `toast(title, options?)`                                            | Default toast. Returns its `id`.                                                 |
| `toast.success / error / info / warning / loading(title, options?)` | Typed variants. Loading toasts stay until updated.                               |
| `toast.promise(promise, { loading, success, error }, options?)`     | Loading toast that resolves into success or error. Returns the original promise. |
| `toast.custom((id) => node, options?)`                              | Fully custom content. Unstyled by default.                                       |
| `toast.update(id, patch)`                                           | Change a visible toast; its timer restarts.                                      |
| `toast.dismiss(id?)`                                                | Dismiss one toast, or all.                                                       |

### Options

| Option                                | Type                        | Description                                                     |
| ------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| `id`                                  | `string`                    | Reuse an id to update instead of adding.                        |
| `description`                         | `ReactNode`                 | Secondary text.                                                 |
| `duration`                            | `number`                    | ms before auto-dismiss; `Infinity` keeps it open.               |
| `action`                              | `{ label, onClick(event) }` | A button; call `event.preventDefault()` to keep the toast open. |
| `dismissible`                         | `boolean`                   | Allow close button, Escape and swipe. Default `true`.           |
| `icon`                                | `ReactNode \| null`         | Replace or hide the icon.                                       |
| `dedupeKey`                           | `string`                    | Repeats update the visible toast and show a `×N` counter.       |
| `toasterId`                           | `string`                    | Send to a specific `<Toaster id>`.                              |
| `className`, `classNames`, `unstyled` |                             | Styling hooks (see below).                                      |
| `onDismiss`, `onAutoClose`            | `(toast) => void`           | Lifecycle callbacks.                                            |

## `<Toaster />`

| Prop                          | Default              | Description                                                                            |
| ----------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `position`                    | `'bottom-right'`     | `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`. |
| `duration`                    | `4000`               | Default duration in ms.                                                                |
| `max`                         | `3`                  | Visible at once; the rest are queued and their timers wait.                            |
| `stacked`                     | `false`              | Collapse into a deck that expands on hover/focus.                                      |
| `richColors`                  | `false`              | Tinted backgrounds per type.                                                           |
| `progress`                    | `false`              | Time-left bar that pauses with the toaster.                                            |
| `closeButton`                 | `false`              | Close button on every dismissible toast.                                               |
| `swipeToDismiss`              | `true`               | Swipe toward the nearest screen edge.                                                  |
| `hotkey`                      | `['altKey', 'KeyT']` | Moves focus to the newest toast. `[]` disables it.                                     |
| `id`                          | —                    | Render only toasts sent with this `toasterId`.                                         |
| `gap`, `offset`               | `12`, `24`           | Spacing in px (offset accepts any CSS length).                                         |
| `theme`                       | provider / `'light'` | `light`, `dark` or `system`.                                                           |
| `unstyled`, `toastClassNames` |                      | Drop default styles / add classes to every part.                                       |
| `label`, `closeLabel`         |                      | Accessible names.                                                                      |

Timers pause while the pointer or focus is inside the toaster, while a toast is being swiped, and while the window is in the background.

## Styling a toast

```tsx
<Toaster
  unstyled
  toastClassNames={{
    toast: 'rounded-lg bg-zinc-900 text-white p-4 flex gap-3',
    title: 'font-semibold',
    actionButton: 'ml-auto underline',
  }}
/>
```

Parts: `toast`, `icon`, `content`, `title`, `description`, `actionButton`, `closeButton`, `progress`, `count`.

## Hooks

- `useToasts()` — all toasts, including queued and leaving ones, for building your own renderer.
- `useToastsPaused()` — whether timers are paused.

## Accessibility

The toaster is a labelled region with a polite live list. Error toasts use `role="alert"`, the rest `role="status"`. Escape dismisses the focused toast.
