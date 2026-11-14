import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { ICONS } from '../shared/icons';
import type { AnyInbox } from './InboxContext';
import { DEFAULT_INBOX_LABELS } from './labels';
import { NotificationPopover, type NotificationPopoverProps } from './NotificationPopover';
import { UnreadBadge } from './UnreadBadge';
import { useInboxStore, useUnreadCount } from './useInbox';

export interface NotificationBellProps extends Omit<
  NotificationPopoverProps,
  'open' | 'onClose' | 'anchorRef' | 'inbox' | 'theme'
> {
  inbox?: AnyInbox;
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Replace the bell icon. */
  icon?: ReactNode;
  /** Badge shows `max+` above this. Defaults to `99`. */
  max?: number;
  /** Show a dot instead of a number. */
  dot?: boolean;
  /** Wiggle the bell when a notification arrives. Defaults to `true`. */
  ring?: boolean;
  theme?: Theme;
  buttonClassName?: string;
}

/** A bell button with an unread badge that opens the notification center. */
export function NotificationBell({
  inbox,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  icon,
  max = 99,
  dot = false,
  ring = true,
  theme: themeProp,
  className,
  buttonClassName,
  labels: labelOverrides,
  ...popoverProps
}: NotificationBellProps) {
  const store = useInboxStore(inbox);
  const theme = useTheme(themeProp);
  const unread = useUnreadCount(store);
  const labels = { ...DEFAULT_INBOX_LABELS, ...labelOverrides };
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const [ringing, setRinging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (open && store.getSnapshot().status === 'idle') void store.load();
  }, [open, store]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = store.events.on('received', (items) => {
      setAnnouncement(labels.newArrivals(items.length));
      if (!ring) return;
      setRinging(true);
      clearTimeout(timer);
      timer = setTimeout(() => setRinging(false), 1000);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels are recreated each render
  }, [store, ring]);

  return (
    <span className={cx('pingly-root pingly-bell-wrap', className)} data-theme={theme}>
      <button
        ref={buttonRef}
        type="button"
        className={cx('pingly-bell', buttonClassName)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.bell(unread)}
        data-ringing={ringing || undefined}
        onClick={() => setOpen(!open)}
      >
        {icon ?? (
          <span
            className="pingly-bell-icon"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICONS.bell }}
          />
        )}
        <UnreadBadge inbox={store} max={max} dot={dot} />
      </button>
      <span className="pingly-visually-hidden" aria-live="polite">
        {announcement}
      </span>
      <NotificationPopover
        {...popoverProps}
        labels={labelOverrides}
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        inbox={store}
        theme={theme}
      />
    </span>
  );
}
