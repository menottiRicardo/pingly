import { useCallback, useState } from 'react';

const PREFIX = 'pingly-playground:';

/** Read a saved setting. Falls back when storage is unavailable or the value is corrupt. */
export function readSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Private mode or quota: the setting just won't survive a reload.
  }
}

/** `useState` that survives reloads. */
export function usePersistentState<T>(
  key: string,
  fallback: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readSetting(key, fallback));
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
        writeSetting(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}

/** Remove every saved playground setting. */
export function clearSettings(): void {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
