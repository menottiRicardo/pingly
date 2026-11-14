const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.closest('[hidden],[inert]'),
  );
}

export interface TrapOptions {
  /** Element to focus first; defaults to the first focusable child. */
  initialFocus?: HTMLElement | null;
  /** Restore focus to the previously focused element on release. Defaults to `true`. */
  returnFocus?: boolean;
  /**
   * Element to focus on release instead of the previously focused one. Useful
   * because some browsers don't focus buttons when they are clicked.
   */
  returnFocusTo?: HTMLElement | null;
}

/** Keep Tab / Shift+Tab inside `container`. Returns a release function. */
export function trapFocus(
  container: HTMLElement,
  { initialFocus, returnFocus = true, returnFocusTo }: TrapOptions = {},
): () => void {
  const previous = returnFocusTo ?? (document.activeElement as HTMLElement | null);
  const first = initialFocus ?? getFocusable(container)[0];
  if (first) first.focus();
  else {
    if (!container.hasAttribute('tabindex')) container.tabIndex = -1;
    container.focus();
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const items = getFocusable(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === firstItem || !container.contains(active))) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && (active === lastItem || !container.contains(active))) {
      event.preventDefault();
      firstItem.focus();
    }
  };
  container.addEventListener('keydown', onKeyDown);
  return () => {
    container.removeEventListener('keydown', onKeyDown);
    if (returnFocus && previous && document.contains(previous)) previous.focus();
  };
}

export type Orientation = 'vertical' | 'horizontal';

/**
 * Arrow-key navigation across a set of items (menus, tabs, lists).
 * Returns the newly focused item, or `null` if the key was not handled.
 */
export function moveFocus(
  event: { key: string; preventDefault(): void },
  items: readonly HTMLElement[],
  orientation: Orientation = 'vertical',
): HTMLElement | null {
  if (items.length === 0) return null;
  const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  const index = items.indexOf(document.activeElement as HTMLElement);
  let target: number;
  switch (event.key) {
    case prevKey:
      target = index <= 0 ? items.length - 1 : index - 1;
      break;
    case nextKey:
      target = index === -1 || index === items.length - 1 ? 0 : index + 1;
      break;
    case 'Home':
      target = 0;
      break;
    case 'End':
      target = items.length - 1;
      break;
    default:
      return null;
  }
  event.preventDefault();
  const next = items[target]!;
  next.focus();
  return next;
}

/** Call `handler` when a pointer goes down outside every given element. */
export function onPointerOutside(
  getElements: () => Array<Element | null | undefined>,
  handler: (event: PointerEvent) => void,
): () => void {
  const listener = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (getElements().some((el) => el && target && el.contains(target))) return;
    handler(event);
  };
  document.addEventListener('pointerdown', listener, true);
  return () => document.removeEventListener('pointerdown', listener, true);
}
