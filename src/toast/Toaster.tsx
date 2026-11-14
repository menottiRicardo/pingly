import type { CSSProperties, FocusEvent } from 'react';
import { useEffect, useMemo } from 'react';
import { store } from './instance';
import { useTheme } from '../shared/ConfigContext';
import { bindWindowFocus, cx, parsePosition, toCssLength } from './dom';
import { selectShown } from './store';
import { Toast } from './Toast';
import type { ToastPosition, ToastTheme } from './types';
import { useToasts } from './useToasts';

export interface ToasterProps {
  /** Where toasts appear. Defaults to `bottom-right`. */
  position?: ToastPosition;
  /** Default auto-dismiss time in ms. Defaults to `4000`. */
  duration?: number;
  /** Maximum toasts shown at once; extras are queued. Defaults to `3`. */
  max?: number;
  /** Space between toasts in px. Defaults to `12`. */
  gap?: number;
  /** Distance from the viewport edge (number in px or any CSS length). Defaults to `24`. */
  offset?: number | string;
  /** Show a close button on every dismissible toast. */
  closeButton?: boolean;
  /** Color scheme. `system` follows `prefers-color-scheme`. Defaults to the provider's theme, else `light`. */
  theme?: ToastTheme;
  /** Accessible name of the notifications region. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function Toaster({
  position = 'bottom-right',
  duration = 4000,
  max = 3,
  gap = 12,
  offset = 24,
  closeButton = false,
  theme: themeProp,
  label = 'Notifications',
  className,
  style,
}: ToasterProps) {
  const theme = useTheme(themeProp);
  const toasts = useToasts();
  const shown = useMemo(() => selectShown(toasts, max).reverse(), [toasts, max]);
  const { x, y } = parsePosition(position);

  useEffect(() => store.configure({ duration, limit: max }), [duration, max]);
  useEffect(() => bindWindowFocus(store), []);

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) store.resume('focus');
  };

  return (
    <section
      aria-label={label}
      className={cx('pingly-root pingly-toaster', className)}
      data-x={x}
      data-y={y}
      data-theme={theme}
      style={
        {
          '--pingly-gap': `${gap}px`,
          '--pingly-offset': toCssLength(offset),
          ...style,
        } as CSSProperties
      }
      onMouseEnter={() => store.pause('hover')}
      onMouseLeave={() => store.resume('hover')}
      onFocus={() => store.pause('focus')}
      onBlur={onBlur}
    >
      <ol className="pingly-list" aria-live="polite">
        {shown.map((t) => (
          <Toast key={t.id} toast={t} closeButton={closeButton} />
        ))}
      </ol>
    </section>
  );
}
