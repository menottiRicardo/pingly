import type { CSSProperties, FocusEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../shared/ConfigContext';
import {
  bindWindowFocus,
  cx,
  describeHotkey,
  matchesHotkey,
  parsePosition,
  toCssLength,
} from './dom';
import { store } from './instance';
import { selectShown } from './store';
import { Toast } from './Toast';
import type { ToastClassNames, ToastPosition, ToastTheme } from './types';
import { useToasts, useToastsPaused } from './useToasts';

export interface ToasterProps {
  /** Show only toasts created with this `toasterId`. Leave unset for the default toaster. */
  id?: string;
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
  /** Collapse toasts into a deck that expands on hover or focus. */
  stacked?: boolean;
  /** Tinted backgrounds per toast type. */
  richColors?: boolean;
  /** Show a bar with the time left on each toast. */
  progress?: boolean;
  /** Allow swiping toasts away. Defaults to `true`. */
  swipeToDismiss?: boolean;
  /** Keys that move focus to the toasts. Defaults to `['altKey', 'KeyT']`; `[]` disables it. */
  hotkey?: string[];
  /** Color scheme. `system` follows `prefers-color-scheme`. Defaults to the provider's theme, else `light`. */
  theme?: ToastTheme;
  /** Accessible name of the notifications region. */
  label?: string;
  /** Accessible label of the close button. */
  closeLabel?: string;
  /** Drop the default toast look; style through `toastClassNames`. */
  unstyled?: boolean;
  toastClassNames?: ToastClassNames;
  className?: string;
  style?: CSSProperties;
}

export function Toaster({
  id,
  position = 'bottom-right',
  duration = 4000,
  max = 3,
  gap = 12,
  offset = 24,
  closeButton = false,
  stacked = false,
  richColors = false,
  progress = false,
  swipeToDismiss = true,
  hotkey = DEFAULT_HOTKEY,
  theme: themeProp,
  label = 'Notifications',
  closeLabel,
  unstyled = false,
  toastClassNames,
  className,
  style,
}: ToasterProps) {
  const theme = useTheme(themeProp);
  const toasts = useToasts();
  const paused = useToastsPaused();
  const [expanded, setExpanded] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  const shown = useMemo(
    () =>
      selectShown(
        toasts.filter((t) => t.toasterId === id),
        max,
      ).reverse(),
    [toasts, id, max],
  );
  const { x, y } = parsePosition(position);
  const hotkeyKey = hotkey.join('+');

  useEffect(() => store.configure({ duration }), [duration]);
  useEffect(() => {
    store.setLimit(id, max);
    return () => store.setLimit(id, undefined);
  }, [id, max]);
  useEffect(() => bindWindowFocus(store), []);
  useEffect(() => {
    if (hotkey.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesHotkey(event, hotkey)) return;
      event.preventDefault();
      const region = regionRef.current;
      const first = region?.querySelector<HTMLElement>('.pingly-toast, [data-state]');
      if (first) {
        if (!first.hasAttribute('tabindex')) first.tabIndex = -1;
        first.focus();
      } else region?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hotkeyKey captures the array's contents
  }, [hotkeyKey]);

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      store.resume('focus');
      setExpanded(false);
    }
  };

  const regionLabel = hotkey.length ? `${label} (${describeHotkey(hotkey)})` : label;

  return (
    <section
      ref={regionRef}
      aria-label={regionLabel}
      tabIndex={-1}
      className={cx('pingly-root pingly-toaster', className)}
      data-x={x}
      data-y={y}
      data-theme={theme}
      data-rich-colors={richColors || undefined}
      data-paused={paused || undefined}
      style={
        {
          '--pingly-gap': `${gap}px`,
          '--pingly-offset': toCssLength(offset),
          ...style,
        } as CSSProperties
      }
      onMouseEnter={() => {
        store.pause('hover');
        setExpanded(true);
      }}
      onMouseLeave={() => {
        store.resume('hover');
        setExpanded(false);
      }}
      onFocus={() => {
        store.pause('focus');
        setExpanded(true);
      }}
      onBlur={onBlur}
    >
      <ol
        className="pingly-list"
        aria-live="polite"
        data-stacked={stacked || undefined}
        data-expanded={stacked ? expanded : undefined}
      >
        {shown.map((t, index) => (
          <Toast
            key={t.id}
            toast={t}
            index={index}
            position={position}
            closeButton={closeButton}
            progress={progress}
            swipeToDismiss={swipeToDismiss}
            classNames={toastClassNames}
            unstyled={unstyled}
            closeLabel={closeLabel}
          />
        ))}
      </ol>
    </section>
  );
}

const DEFAULT_HOTKEY = ['altKey', 'KeyT'];
