import type { Theme } from '../shared/config';

export type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning' | 'loading';

export type ToastPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** `visible` while shown, `leaving` while the exit animation runs. */
export type ToastState = 'visible' | 'leaving';

export type ToastTheme = Theme;

export interface ToastActionEvent {
  preventDefault(): void;
  readonly defaultPrevented: boolean;
}

export interface ToastAction<C = unknown> {
  label: C;
  /** Call `event.preventDefault()` to keep the toast open after the click. */
  onClick: (event: ToastActionEvent) => void;
}

/** Extra class names for each part of a toast. */
export interface ToastClassNames {
  toast?: string;
  icon?: string;
  content?: string;
  title?: string;
  description?: string;
  actionButton?: string;
  closeButton?: string;
  progress?: string;
  count?: string;
}

export interface ToastOptions<C = unknown> {
  /** Reuse an id to update an existing toast instead of creating a new one. */
  id?: string;
  type?: ToastType;
  description?: C;
  /** Milliseconds before auto-dismiss. `Infinity` keeps the toast until dismissed. */
  duration?: number;
  action?: ToastAction<C>;
  /** Whether the user can dismiss the toast (close button, Escape, swipe). Defaults to `true`. */
  dismissible?: boolean;
  /** Replace the type icon. `null` hides it. */
  icon?: C | null;
  /** Show the toast in the `<Toaster>` with this `id` instead of the default one. */
  toasterId?: string;
  /**
   * Toasts sharing a `dedupeKey` don't stack: the visible one is updated
   * and shows a counter instead.
   */
  dedupeKey?: string;
  className?: string;
  classNames?: ToastClassNames;
  /** Drop the default look and rely on `className` / `classNames` only. */
  unstyled?: boolean;
  /** Called when the toast is dismissed by the user or programmatically. */
  onDismiss?: (toast: ToastData<C>) => void;
  /** Called when the toast closes because its duration elapsed. */
  onAutoClose?: (toast: ToastData<C>) => void;
}

export interface ToastData<C = unknown> extends Omit<ToastOptions<C>, 'id' | 'type'> {
  id: string;
  type: ToastType;
  title: C;
  state: ToastState;
  createdAt: number;
  /** Changes whenever the toast is updated; its timer restarts at the same moment. */
  updatedAt: number;
  /** How many times a toast with this `dedupeKey` was shown while visible. */
  count: number;
  /** Fully custom content, from `toast.custom()`. */
  render?: (id: string) => C;
}

export type ToastUpdate<C = unknown> = Partial<Omit<ToastOptions<C>, 'id'>> & { title?: C };
