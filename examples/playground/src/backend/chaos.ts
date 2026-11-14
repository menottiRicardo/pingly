import { readSetting, writeSetting } from '../persist';

/** Knobs that make the fake backend misbehave. */
export interface Chaos {
  /** Added to every request and connection, in ms. */
  latency: number;
  /** 0–1 chance that any API call fails. */
  failureRate: number;
  /** Every request and connection attempt fails. */
  offline: boolean;
  /** The next API call fails, then this resets. */
  failNext: boolean;
}

const DEFAULTS: Chaos = { latency: 250, failureRate: 0, offline: false, failNext: false };
const KEY = 'chaos';

let state: Chaos = { ...DEFAULTS, ...readSetting<Partial<Chaos>>(KEY, {}), failNext: false };
const listeners = new Set<() => void>();

export const chaos = {
  get: () => state,
  set(patch: Partial<Chaos>) {
    state = { ...state, ...patch };
    writeSetting(KEY, { ...state, failNext: false });
    for (const l of [...listeners]) l();
  },
  reset() {
    chaos.set(DEFAULTS);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ServerError extends Error {
  constructor(public readonly operation: string) {
    super(`Server error (500) during ${operation}`);
    this.name = 'ServerError';
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Run a fake API call through the chaos knobs. */
export async function withChaos<T>(operation: string, run: () => T | Promise<T>): Promise<T> {
  const { latency, offline, failNext, failureRate } = chaos.get();
  await sleep(latency);
  if (offline) throw new NetworkError();
  if (failNext) {
    chaos.set({ failNext: false });
    throw new ServerError(operation);
  }
  if (Math.random() < failureRate) throw new ServerError(operation);
  return run();
}
