export interface PreferenceChannel<C = unknown> {
  id: string;
  label: C;
}

export interface PreferenceCategory<C = unknown> {
  id: string;
  label: C;
  description?: C;
  /** Channels that apply to this category. Defaults to all channels. */
  channels?: string[];
  /** Channels that can't be turned off (e.g. security emails). */
  locked?: string[];
}

export interface QuietHours {
  enabled: boolean;
  /** `HH:MM`, 24-hour. */
  start: string;
  /** `HH:MM`, 24-hour. May be earlier than `start` for overnight ranges. */
  end: string;
  /** IANA time zone. Defaults to the browser's. */
  timeZone?: string;
  /** Days it applies (0 = Sunday). Defaults to every day. */
  days?: number[];
}

export interface PreferenceValues {
  /** `channels[categoryId][channelId]` → enabled. Missing entries count as enabled. */
  channels: Record<string, Record<string, boolean>>;
  /** Muted categories are silent everywhere except locked channels. */
  muted: Record<string, boolean>;
  quietHours: QuietHours;
}

export interface PreferencesAdapter {
  load(): Promise<Partial<PreferenceValues> | null>;
  save(values: PreferenceValues): Promise<void>;
}

export type PreferencesStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

export interface PreferencesState {
  values: PreferenceValues;
  status: PreferencesStatus;
  /** Changed since the last successful save. */
  dirty: boolean;
  error: unknown;
  savedAt: number | null;
}
