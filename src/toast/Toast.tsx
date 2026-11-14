import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import { CLOSE_ICON, TOAST_ICONS, cx, toastRole } from './dom';
import { store } from './instance';
import { SwipeTracker, swipeConfigFor } from './swipe';
import type { ToastClassNames, ToastData, ToastPosition } from './types';

export interface ToastProps {
  toast: ToastData<ReactNode>;
  closeButton?: boolean;
  /** Position of the parent toaster; decides the swipe direction. */
  position?: ToastPosition;
  /** Allow swiping the toast away. Defaults to `true`. */
  swipeToDismiss?: boolean;
  /** Show a bar with the time left. */
  progress?: boolean;
  /** 0 for the newest toast; used by the stacked layout. */
  index?: number;
  classNames?: ToastClassNames;
  unstyled?: boolean;
  closeLabel?: string;
}

const pick = (unstyled: boolean, base: string, ...extra: Array<string | undefined>) =>
  cx(unstyled ? undefined : base, ...extra);

export function Toast({
  toast,
  closeButton = false,
  position = 'bottom-right',
  swipeToDismiss = true,
  progress = false,
  index = 0,
  classNames: toasterClassNames,
  unstyled: toasterUnstyled = false,
  closeLabel = 'Close notification',
}: ToastProps) {
  const { id, type, title, description, action, dismissible, className, state, render } = toast;
  const unstyled = toast.unstyled ?? toasterUnstyled;
  const cn: ToastClassNames = { ...toasterClassNames, ...toast.classNames };
  const ref = useRef<HTMLLIElement>(null);
  const swipe = useMemo(() => swipeConfigFor(position), [position]);
  const tracker = useMemo(() => new SwipeTracker(swipe), [swipe]);
  const duration = store.durationOf(toast);
  const canSwipe = swipeToDismiss && dismissible !== false;

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.key === 'Escape' && dismissible) store.dismiss(id);
  };

  const onAction = (event: MouseEvent<HTMLButtonElement>) => {
    action?.onClick(event);
    if (!event.defaultPrevented) store.dismiss(id);
  };

  const setOffset = (offset: number | null) => {
    const el = ref.current;
    if (!el) return;
    if (offset === null) {
      el.style.removeProperty('--pingly-swipe');
      delete el.dataset.swiping;
    } else {
      el.style.setProperty('--pingly-swipe', `${offset}px`);
      el.dataset.swiping = 'true';
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLLIElement>) => {
    if (!canSwipe || event.button !== 0 || state !== 'visible') return;
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    tracker.begin(event.clientX, event.clientY);
    store.pause('swipe');
  };

  const onPointerMove = (event: PointerEvent<HTMLLIElement>) => {
    if (tracker.active) setOffset(tracker.move(event.clientX, event.clientY));
  };

  const onPointerUp = () => {
    if (!tracker.active) return;
    const result = tracker.end();
    store.resume('swipe');
    if (result.dismiss && ref.current) {
      ref.current.dataset.swipeOut = String(result.sign);
      store.dismiss(id);
    } else {
      setOffset(null);
    }
  };

  const common = {
    ref,
    'data-type': type,
    'data-state': state,
    'data-index': index,
    'data-swipe-axis': canSwipe ? swipe.axis : undefined,
    style: { '--pingly-index': index } as CSSProperties,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  if (render) {
    return (
      <li
        {...common}
        className={pick(unstyled, 'pingly-toast', className, cn.toast)}
        data-custom="true"
      >
        {render(id)}
      </li>
    );
  }

  const icon =
    toast.icon === null ? null : toast.icon !== undefined ? (
      <span className={pick(unstyled, 'pingly-icon', cn.icon)} aria-hidden="true">
        {toast.icon}
      </span>
    ) : TOAST_ICONS[type] ? (
      <span
        className={pick(unstyled, 'pingly-icon', cn.icon)}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: TOAST_ICONS[type]! }}
      />
    ) : null;

  return (
    <li {...common} className={pick(unstyled, 'pingly-toast', className, cn.toast)}>
      {icon}
      <div
        className={pick(unstyled, 'pingly-content', cn.content)}
        role={toastRole(type) === 'alert' ? 'alert' : undefined}
        aria-atomic="true"
      >
        <div className={pick(unstyled, 'pingly-title', cn.title)}>
          {title}
          {toast.count > 1 && (
            <span className={pick(unstyled, 'pingly-count', cn.count)}>×{toast.count}</span>
          )}
        </div>
        {description != null && (
          <div className={pick(unstyled, 'pingly-description', cn.description)}>{description}</div>
        )}
      </div>
      {action && (
        <button
          type="button"
          className={pick(unstyled, 'pingly-action', cn.actionButton)}
          onClick={onAction}
        >
          {action.label}
        </button>
      )}
      {closeButton && dismissible && (
        <button
          type="button"
          className={pick(unstyled, 'pingly-close', cn.closeButton)}
          aria-label={closeLabel}
          onClick={() => store.dismiss(id)}
          dangerouslySetInnerHTML={{ __html: CLOSE_ICON }}
        />
      )}
      {progress && Number.isFinite(duration) && state === 'visible' && (
        <span
          key={toast.updatedAt}
          className={pick(unstyled, 'pingly-progress', cn.progress)}
          style={{ animationDuration: `${duration}ms` }}
          aria-hidden="true"
        />
      )}
    </li>
  );
}
