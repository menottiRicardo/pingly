/**
 * Minimal observable store. Every pingly store exposes the same
 * `subscribe` / `getSnapshot` pair so views can stay thin.
 */
export class Store<S> {
  protected state: S;
  private readonly listeners = new Set<() => void>();

  constructor(initial: S) {
    this.state = initial;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): S => this.state;

  protected setState(next: S | ((prev: S) => S)): void {
    const value = typeof next === 'function' ? (next as (prev: S) => S)(this.state) : next;
    if (Object.is(value, this.state)) return;
    this.state = value;
    this.notify();
  }

  protected notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
