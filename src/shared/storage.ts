import { hasDom } from './env';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage when it exists and is writable, otherwise `null`. */
export function safeStorage(): StorageLike | null {
  if (!hasDom()) return null;
  try {
    const storage = window.localStorage;
    const probe = '__pingly__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T, storage = safeStorage()): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown, storage = safeStorage()): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled: persistence is best effort.
  }
}
