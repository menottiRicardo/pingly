import { createContext, useContext } from 'react';
import type { PinglyConfig, Theme } from './config';

export const ConfigContext = createContext<PinglyConfig>({});

export function useConfig(): PinglyConfig {
  return useContext(ConfigContext);
}

/** Resolve a component's theme: its own prop, then the provider's, then light. */
export function useTheme(theme?: Theme): Theme {
  const config = useContext(ConfigContext);
  return theme ?? config.theme ?? 'light';
}
