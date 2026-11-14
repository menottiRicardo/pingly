import type { ToastPosition, ToastType } from './types';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Errors interrupt screen readers; everything else is announced politely. */
export function toastRole(type: ToastType): 'alert' | 'status' {
  return type === 'error' ? 'alert' : 'status';
}

export function parsePosition(position: ToastPosition): {
  y: 'top' | 'bottom';
  x: 'left' | 'center' | 'right';
} {
  const [y, x] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  return { y, x };
}

export function toCssLength(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;

export const ICONS: Record<ToastType, string | null> = {
  default: null,
  success: svg('<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>'),
  error: svg('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  warning: svg(
    '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  ),
  loading: svg('<path d="M21 12a9 9 0 1 1-6.2-8.6" class="pingly-spinner"/>'),
};

export const CLOSE_ICON = svg('<path d="M18 6 6 18M6 6l12 12"/>');

/** Pause timers while the window is in the background. Returns a cleanup function. */
export function bindWindowFocus(store: {
  pause(reason?: string): void;
  resume(reason?: string): void;
}): () => void {
  if (typeof window === 'undefined') return () => {};
  const onBlur = () => store.pause('window');
  const onFocus = () => store.resume('window');
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  return () => {
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    store.resume('window');
  };
}
