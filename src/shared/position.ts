export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Placement = Side | `${Side}-${Align}`;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionOptions {
  placement?: Placement;
  /** Gap between anchor and floating element. */
  offset?: number;
  /** Minimum distance kept from the viewport edges. */
  padding?: number;
  viewport: { width: number; height: number };
}

export interface PositionResult {
  x: number;
  y: number;
  placement: Placement;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function parse(placement: Placement): [Side, Align] {
  const [side, align = 'center'] = placement.split('-') as [Side, Align?];
  return [side, align];
}

function place(
  anchor: Rect,
  size: { width: number; height: number },
  side: Side,
  align: Align,
  offset: number,
) {
  const vertical = side === 'top' || side === 'bottom';
  let x: number;
  let y: number;
  if (vertical) {
    y = side === 'bottom' ? anchor.y + anchor.height + offset : anchor.y - size.height - offset;
    x =
      align === 'start'
        ? anchor.x
        : align === 'end'
          ? anchor.x + anchor.width - size.width
          : anchor.x + anchor.width / 2 - size.width / 2;
  } else {
    x = side === 'right' ? anchor.x + anchor.width + offset : anchor.x - size.width - offset;
    y =
      align === 'start'
        ? anchor.y
        : align === 'end'
          ? anchor.y + anchor.height - size.height
          : anchor.y + anchor.height / 2 - size.height / 2;
  }
  return { x, y };
}

function overflow(
  side: Side,
  pos: { x: number; y: number },
  size: { width: number; height: number },
  opts: Required<Omit<PositionOptions, 'placement'>>,
) {
  const { viewport, padding } = opts;
  switch (side) {
    case 'top':
      return padding - pos.y;
    case 'bottom':
      return pos.y + size.height - (viewport.height - padding);
    case 'left':
      return padding - pos.x;
    case 'right':
      return pos.x + size.width - (viewport.width - padding);
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Place a floating element next to an anchor, flipping and shifting to stay on screen. */
export function computePosition(
  anchor: Rect,
  size: { width: number; height: number },
  { placement = 'bottom-end', offset = 8, padding = 8, viewport }: PositionOptions,
): PositionResult {
  const opts = { offset, padding, viewport };
  const [initialSide, align] = parse(placement);
  let side = initialSide;
  let pos = place(anchor, size, side, align, offset);
  if (overflow(side, pos, size, opts) > 0) {
    const flipped = OPPOSITE[side];
    const flippedPos = place(anchor, size, flipped, align, offset);
    if (overflow(flipped, flippedPos, size, opts) < overflow(side, pos, size, opts)) {
      side = flipped;
      pos = flippedPos;
    }
  }
  const vertical = side === 'top' || side === 'bottom';
  if (vertical) pos.x = clamp(pos.x, padding, viewport.width - size.width - padding);
  else pos.y = clamp(pos.y, padding, viewport.height - size.height - padding);
  return {
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    placement: align === 'center' ? side : `${side}-${align}`,
  };
}

/**
 * Keep `floating` (position: fixed) attached to `anchor` while the page
 * scrolls or resizes. Returns a cleanup function.
 */
export function autoPosition(
  anchor: HTMLElement,
  floating: HTMLElement,
  options: Omit<PositionOptions, 'viewport'> = {},
): () => void {
  let frame = 0;
  const update = () => {
    frame = 0;
    const a = anchor.getBoundingClientRect();
    const f = floating.getBoundingClientRect();
    const result = computePosition(
      { x: a.left, y: a.top, width: a.width, height: a.height },
      { width: f.width, height: f.height },
      { ...options, viewport: { width: window.innerWidth, height: window.innerHeight } },
    );
    floating.style.left = `${result.x}px`;
    floating.style.top = `${result.y}px`;
    floating.dataset.placement = result.placement;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  observer?.observe(anchor);
  observer?.observe(floating);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('scroll', schedule, true);
    observer?.disconnect();
  };
}
