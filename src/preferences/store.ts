import { readJSON, safeStorage, writeJSON } from '../shared/storage';
import { Store } from '../shared/store-base';
import { isWithinQuietHours } from './quiet-hours';
import type {
  PreferenceCategory,
  PreferenceChannel,
  PreferencesAdapter,
  PreferencesState,
  PreferenceValues,
  QuietHours,
} from './types';

export interface PreferencesOptions<C = unknown> {
  categories: PreferenceCategory<C>[];
  channels: PreferenceChannel<C>[];
  /** Starting values before anything is loaded. */
  defaults?: Partial<PreferenceValues>;
  adapter?: PreferencesAdapter;
  /** Save shortly after each change. Defaults to `true`. */
  autoSave?: boolean;
  /** Debounce for auto-save in ms. Defaults to `600`. */
  saveDelay?: number;
}

const DEFAULT_QUIET: QuietHours = { enabled: false, start: '22:00', end: '08:00' };

function mergeValues(
  base: PreferenceValues,
  patch?: Partial<PreferenceValues> | null,
): PreferenceValues {
  if (!patch) return base;
  return {
    channels: { ...base.channels, ...patch.channels },
    muted: { ...base.muted, ...patch.muted },
    quietHours: { ...base.quietHours, ...patch.quietHours },
  };
}

export class PreferencesStore<C = unknown> extends Store<PreferencesState> {
  readonly categories: PreferenceCategory<C>[];
  readonly channels: PreferenceChannel<C>[];
  private readonly adapter?: PreferencesAdapter;
  private readonly autoSave: boolean;
  private readonly saveDelay: number;
  private readonly defaults: PreferenceValues;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor({
    categories,
    channels,
    defaults,
    adapter,
    autoSave = true,
    saveDelay = 600,
  }: PreferencesOptions<C>) {
    const values = mergeValues({ channels: {}, muted: {}, quietHours: DEFAULT_QUIET }, defaults);
    super({ values, status: adapter ? 'idle' : 'ready', dirty: false, error: null, savedAt: null });
    this.categories = categories;
    this.channels = channels;
    this.adapter = adapter;
    this.autoSave = autoSave;
    this.saveDelay = saveDelay;
    this.defaults = values;
  }

  async load(): Promise<void> {
    if (!this.adapter) return;
    this.setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const loaded = await this.adapter.load();
      this.setState((s) => ({
        ...s,
        values: mergeValues(this.defaults, loaded),
        status: 'ready',
        dirty: false,
      }));
    } catch (error) {
      this.setState((s) => ({ ...s, status: 'error', error }));
    }
  }

  /** Channels that apply to a category. */
  channelsFor(categoryId: string): PreferenceChannel<C>[] {
    const category = this.categories.find((c) => c.id === categoryId);
    if (!category?.channels) return this.channels;
    return this.channels.filter((ch) => category.channels!.includes(ch.id));
  }

  isLocked(categoryId: string, channelId: string): boolean {
    return Boolean(this.categories.find((c) => c.id === categoryId)?.locked?.includes(channelId));
  }

  /**
   * Whether a category may use a channel. Unknown categories are allowed;
   * locked channels are always on.
   */
  isEnabled(categoryId: string | undefined, channelId: string): boolean {
    if (categoryId === undefined) return true;
    const category = this.categories.find((c) => c.id === categoryId);
    if (!category) return true;
    if (category.channels && !category.channels.includes(channelId)) return false;
    if (this.isLocked(categoryId, channelId)) return true;
    const { muted, channels } = this.state.values;
    if (muted[categoryId]) return false;
    return channels[categoryId]?.[channelId] ?? true;
  }

  isQuiet(date = new Date()): boolean {
    return isWithinQuietHours(this.state.values.quietHours, date);
  }

  /**
   * Decide a delivery. Interruptive deliveries (toasts, sounds, OS
   * notifications) are also held back during quiet hours.
   */
  allows(
    categoryId: string | undefined,
    channelId: string,
    { interruptive = false, date }: { interruptive?: boolean; date?: Date } = {},
  ): boolean {
    if (!this.isEnabled(categoryId, channelId)) return false;
    return !(interruptive && this.isQuiet(date));
  }

  set(categoryId: string, channelId: string, enabled: boolean): void {
    if (this.isLocked(categoryId, channelId)) return;
    this.change((v) => ({
      ...v,
      channels: {
        ...v.channels,
        [categoryId]: { ...v.channels[categoryId], [channelId]: enabled },
      },
    }));
  }

  mute(categoryId: string, muted: boolean): void {
    this.change((v) => ({ ...v, muted: { ...v.muted, [categoryId]: muted } }));
  }

  setQuietHours(patch: Partial<QuietHours>): void {
    this.change((v) => ({ ...v, quietHours: { ...v.quietHours, ...patch } }));
  }

  /** Back to the defaults given at creation. */
  reset(): void {
    this.change(() => this.defaults);
  }

  async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (!this.adapter) {
      this.setState((s) => ({ ...s, dirty: false, savedAt: Date.now() }));
      return;
    }
    const values = this.state.values;
    this.setState((s) => ({ ...s, status: 'saving', error: null }));
    try {
      await this.adapter.save(values);
      this.setState((s) => ({
        ...s,
        status: 'ready',
        dirty: s.values !== values,
        savedAt: Date.now(),
      }));
    } catch (error) {
      this.setState((s) => ({ ...s, status: 'error', error }));
    }
  }

  private change(fn: (values: PreferenceValues) => PreferenceValues) {
    this.setState((s) => ({ ...s, values: fn(s.values), dirty: true }));
    if (this.autoSave) {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => void this.save(), this.saveDelay);
    }
  }
}

/** Keeps preferences in memory. */
export function memoryPreferences(
  initial: Partial<PreferenceValues> | null = null,
): PreferencesAdapter & { saved: PreferenceValues | null } {
  const adapter = {
    saved: null as PreferenceValues | null,
    load: async () => adapter.saved ?? initial,
    save: async (values: PreferenceValues) => {
      adapter.saved = values;
    },
  };
  return adapter;
}

/** Keeps preferences in localStorage under `key`. */
export function localPreferences(key = 'pingly-preferences'): PreferencesAdapter {
  return {
    load: async () => readJSON<Partial<PreferenceValues> | null>(key, null),
    save: async (values) => writeJSON(key, values, safeStorage()),
  };
}

export interface RestPreferencesOptions {
  /** `GET` returns the values; `PUT` saves them. */
  url: string;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  fetch?: typeof fetch;
}

/** Loads and saves preferences as JSON at one URL. */
export function restPreferences({
  url,
  headers,
  fetch: doFetch,
}: RestPreferencesOptions): PreferencesAdapter {
  const request = async (init: RequestInit) => {
    const extra = typeof headers === 'function' ? await headers() : headers;
    const h = new Headers(extra);
    h.set('Accept', 'application/json');
    if (init.body) h.set('Content-Type', 'application/json');
    const res = await (doFetch ?? fetch)(url, { ...init, headers: h });
    if (!res.ok) throw new Error(`Preferences request failed with status ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
  return {
    load: () => request({ method: 'GET' }),
    save: async (values) => {
      await request({ method: 'PUT', body: JSON.stringify(values) });
    },
  };
}
