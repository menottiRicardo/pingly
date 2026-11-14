import { hasDom } from '../shared/env';

export type PermissionStatus = NotificationPermission | 'unsupported';

export function isSupported(): boolean {
  return hasDom() && 'Notification' in window;
}

export function getPermission(): PermissionStatus {
  return isSupported() ? window.Notification.permission : 'unsupported';
}

/** Ask the browser for permission. Call it from a user gesture (a click). */
export async function requestPermission(): Promise<PermissionStatus> {
  if (!isSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    // Old Safari only supports the callback form.
    return new Promise((resolve) => window.Notification.requestPermission(resolve));
  }
}

/** Call `listener` when the permission changes (where the browser reports it). */
export function watchPermission(listener: (status: PermissionStatus) => void): () => void {
  if (!isSupported() || !navigator.permissions?.query) return () => {};
  let target: PermissionStatus_ | null = null;
  let cancelled = false;
  const onChange = () => listener(getPermission());
  navigator.permissions
    .query({ name: 'notifications' as PermissionName })
    .then((result) => {
      if (cancelled) return;
      target = result;
      result.addEventListener('change', onChange);
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    target?.removeEventListener('change', onChange);
  };
}

/** The browser's `PermissionStatus` object (renamed to avoid clashing with ours). */
type PermissionStatus_ = globalThis.PermissionStatus;

export interface SystemNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
  data?: unknown;
  silent?: boolean;
  requireInteraction?: boolean;
  /** Only show while the tab is hidden. Defaults to `true`. */
  onlyWhenHidden?: boolean;
  /** Close automatically after this many ms. */
  autoCloseMs?: number;
  /** Focuses the tab by default; return `false` to skip that. */
  onClick?: (notification: globalThis.Notification) => void | false;
  /** Show through a service worker (required on some mobile browsers). */
  registration?: ServiceWorkerRegistration;
}

/**
 * Show an operating-system notification. Resolves to the notification, or
 * `null` when not allowed, not supported or skipped because the tab is visible.
 */
export async function notify(
  options: SystemNotificationOptions,
): Promise<globalThis.Notification | null> {
  if (getPermission() !== 'granted') return null;
  const { title, onlyWhenHidden = true, autoCloseMs, onClick, registration, ...init } = options;
  if (onlyWhenHidden && document.visibilityState === 'visible') return null;
  if (registration) {
    await registration.showNotification(title, init);
    return null;
  }
  const notification = new window.Notification(title, init);
  notification.onclick = () => {
    if (onClick?.(notification) !== false) {
      window.focus();
      notification.close();
    }
  };
  if (autoCloseMs) setTimeout(() => notification.close(), autoCloseMs);
  return notification;
}
