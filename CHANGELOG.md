# Changelog

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
