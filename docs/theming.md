# Theming

Import `pingly/styles.css` (or `pingly/tokens.css` plus only the areas you use, e.g. `pingly/toast.css`, `pingly/inbox.css`).

## Themes

Every component takes `theme="light" | "dark" | "system"`, or inherits it from `<NotificationProvider theme>`.

## Tokens

All components read the same CSS variables. Override them on `.pingly-root`:

```css
.pingly-root {
  --pingly-accent: #7c3aed;
  --pingly-radius: 14px;
  --pingly-font: 'Inter', sans-serif;
}
.pingly-root[data-theme='dark'] {
  --pingly-bg: #0b0b10;
}
```

| Token                                                                         | Used for                           |
| ----------------------------------------------------------------------------- | ---------------------------------- |
| `--pingly-bg`, `--pingly-bg-subtle`, `--pingly-bg-hover`                      | Surfaces                           |
| `--pingly-fg`, `--pingly-muted`, `--pingly-faint`                             | Text                               |
| `--pingly-border`, `--pingly-shadow`, `--pingly-radius`, `--pingly-radius-sm` | Shape                              |
| `--pingly-accent`, `--pingly-accent-fg`, `--pingly-focus`                     | Accents and focus rings            |
| `--pingly-unread`                                                             | Unread item background             |
| `--pingly-success / error / info / warning` (+ `-bg`)                         | Status colors                      |
| `--pingly-badge-bg`, `--pingly-badge-fg`                                      | Unread badge                       |
| `--pingly-width`, `--pingly-duration`, `--pingly-font`                        | Toast width, animation speed, font |

## Targeting states

Components expose state as data attributes: `data-type`, `data-state`, `data-unread`, `data-variant`, `data-status`, `data-theme`. Class names all start with `pingly-`.

## Accessibility

- Toasts: labelled region, polite live list, `role="alert"` for errors.
- Bell: `aria-haspopup`, `aria-expanded`, a label with the unread count, and a polite announcement for arrivals.
- Popover: dialog with focus trap, Escape/outside click to close, focus returns to the bell, arrow keys between items.
- Tabs, switches and checkboxes use native semantics or the matching ARIA roles.
- All animation respects `prefers-reduced-motion`.
