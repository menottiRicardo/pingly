export interface BackoffOptions {
  /** First delay in ms. Defaults to `500`. */
  initial?: number;
  /** Largest delay in ms. Defaults to `30000`. */
  max?: number;
  /** Growth per attempt. Defaults to `2`. */
  factor?: number;
  /**
   * `equal` (default) waits between half and the full delay; `full` anywhere
   * from 0 to the delay; `none` uses the exact delay.
   */
  jitter?: 'equal' | 'full' | 'none';
  random?: () => number;
}

/** Delay before reconnect attempt number `attempt` (0-based). */
export function backoffDelay(
  attempt: number,
  {
    initial = 500,
    max = 30_000,
    factor = 2,
    jitter = 'equal',
    random = Math.random,
  }: BackoffOptions = {},
): number {
  const exp = Math.min(max, initial * factor ** attempt);
  if (jitter === 'none') return exp;
  if (jitter === 'full') return Math.round(random() * exp);
  return Math.round(exp / 2 + (random() * exp) / 2);
}
