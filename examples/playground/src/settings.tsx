import { createContext, useContext, type ReactNode } from 'react';
import type { Theme, ToastPosition } from 'pingly';
import type { TransportKind } from './backend/client';
import { usePersistentState } from './persist';

export interface Settings {
  theme: Theme;
  locale: string;
  position: ToastPosition;
  stacked: boolean;
  richColors: boolean;
  progress: boolean;
  closeButton: boolean;
  transport: TransportKind;
  streaming: boolean;
  streamEveryMs: number;
  systemNotifications: boolean;
  sound: boolean;
  titleBadge: boolean;
  faviconBadge: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  locale: typeof navigator === 'undefined' ? 'en-US' : navigator.language,
  position: 'bottom-right',
  stacked: false,
  richColors: false,
  progress: true,
  closeButton: true,
  transport: 'websocket',
  streaming: false,
  streamEveryMs: 4_000,
  systemNotifications: true,
  sound: false,
  titleBadge: true,
  faviconBadge: false,
};

type Update = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

const SettingsContext = createContext<{
  settings: Settings;
  update: Update;
  reset: () => void;
} | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistentState<Partial<Settings>>('settings', {});
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  const update: Update = (key, value) => setStored((prev) => ({ ...prev, [key]: value }));
  const reset = () => setStored({});
  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
