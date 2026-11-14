import { ICONS } from '../shared/icons';
import type { ToastPosition, ToastType } from './types';

export { cx } from '../shared/cx';

export const TOAST_ICONS: Record<ToastType, string | null> = {
  default: null,
  success: ICONS.success,
  error: ICONS.error,
  info: ICONS.info,
  warning: ICONS.warning,
  loading: ICONS.loading,
};

export const CLOSE_ICON = ICONS.close;

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
