import type { ReactNode } from 'react';
import { PreferencesStore, type PreferencesOptions } from './store';

/** Create a preferences store for React. */
export function createPreferences(
  options: PreferencesOptions<ReactNode>,
): PreferencesStore<ReactNode> {
  return new PreferencesStore<ReactNode>(options);
}
