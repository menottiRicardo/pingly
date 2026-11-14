import type { ToastPosition } from './types';

export type SwipeAxis = 'x' | 'y';

export interface SwipeConfig {
  axis: SwipeAxis;
  /** Direction that dismisses: 1 = right/down, -1 = left/up, 0 = either. */
  direction: 1 | -1 | 0;
}

/** Toasts swipe toward the edge of the screen they sit on. */
export function swipeConfigFor(position: ToastPosition): SwipeConfig {
  const [y, x] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  if (x === 'center') return { axis: 'y', direction: y === 'top' ? -1 : 1 };
  return { axis: 'x', direction: x === 'left' ? -1 : 1 };
}

export interface SwipeResult {
  dismiss: boolean;
  offset: number;
  /** -1 or 1: which way the toast should leave when dismissed. */
  sign: 1 | -1;
}

/** Tracks a pointer drag and decides whether it should dismiss a toast. */
export class SwipeTracker {
  private origin: { x: number; y: number; time: number } | null = null;
  private offset = 0;

  constructor(
    private readonly config: SwipeConfig,
    /** Distance in px that dismisses regardless of speed. */
    private readonly threshold = 45,
    /** Speed in px/ms that dismisses a shorter flick. */
    private readonly velocity = 0.11,
  ) {}

  get active(): boolean {
    return this.origin !== null;
  }

  begin(x: number, y: number, time = Date.now()): void {
    this.origin = { x, y, time };
    this.offset = 0;
  }

  /** Returns the visual offset along the swipe axis, damped in the wrong direction. */
  move(x: number, y: number): number {
    if (!this.origin) return 0;
    const raw = this.config.axis === 'x' ? x - this.origin.x : y - this.origin.y;
    const allowed = this.config.direction === 0 || Math.sign(raw) === this.config.direction;
    this.offset = allowed ? raw : raw * 0.15;
    return this.offset;
  }

  end(time = Date.now()): SwipeResult {
    const origin = this.origin;
    this.origin = null;
    const offset = this.offset;
    this.offset = 0;
    const sign = (offset < 0 ? -1 : 1) as 1 | -1;
    if (!origin) return { dismiss: false, offset: 0, sign };
    const allowed = this.config.direction === 0 || sign === this.config.direction;
    const speed = Math.abs(offset) / Math.max(1, time - origin.time);
    const dismiss = allowed && (Math.abs(offset) >= this.threshold || speed >= this.velocity);
    return { dismiss, offset, sign };
  }
}
