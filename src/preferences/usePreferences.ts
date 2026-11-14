import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import type { PreferencesStore } from './store';
import type { PreferencesState } from './types';

export function usePreferences(store: PreferencesStore<ReactNode>): PreferencesState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
