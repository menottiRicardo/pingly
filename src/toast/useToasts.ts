import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { store } from './instance';
import type { ToastData } from './types';

/**
 * Subscribe to the current toasts, including queued ones and those playing
 * their exit animation. Useful for building a fully custom renderer.
 */
export function useToasts(): readonly ToastData<ReactNode>[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** Whether toast timers are currently paused. */
export function useToastsPaused(): boolean {
  return useSyncExternalStore(store.subscribe, store.getPaused, store.getPaused);
}
