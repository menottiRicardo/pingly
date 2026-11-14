/** True when running in a browser. Never touches globals at import time. */
export function hasDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}
