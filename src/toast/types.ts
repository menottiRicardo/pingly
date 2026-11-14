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

export interface ToastOptions<C = unknown> {
  /** Reuse an id to update an existing toast instead of creating a new one. */
  id?: string;
  type?: ToastType;
  description?: C;
  /** Milliseconds before auto-dismiss. `Infinity` keeps the toast until dismissed. */
  duration?: number;
  action?: ToastAction<C>;
  /** Whether the user can dismiss the toast (close button, Escape). Defaults to `true`. */
  dismissible?: boolean;
  className?: string;
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
}

export type ToastUpdate<C = unknown> = Partial<Omit<ToastOptions<C>, 'id'>> & { title?: C };
