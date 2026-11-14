import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { onPointerOutside, trapFocus } from '../shared/focus';
import { autoPosition, type Placement } from '../shared/position';
import type { AnyInbox } from './InboxContext';
import { InboxHeader } from './InboxHeader';
import { InboxTabs } from './InboxTabs';
import { DEFAULT_INBOX_LABELS, type InboxLabels } from './labels';
import { NotificationList, type NotificationListProps } from './NotificationList';
import { defaultTabs, type InboxTab } from './tabs';
import { useInboxStore } from './useInbox';

export interface NotificationPopoverProps extends Pick<
  NotificationListProps,
  'onNavigate' | 'onAction' | 'renderItem' | 'groupByDay' | 'emptyState'
> {
  open: boolean;
  onClose: () => void;
  /** Element the panel is attached to. */
  anchorRef: RefObject<HTMLElement | null>;
  inbox?: AnyInbox;
  placement?: Placement;
  /** Filter tabs. `false` hides them. Defaults to All / Unread. */
  tabs?: InboxTab<ReactNode>[] | false;
  /** Shows a settings button in the header. */
  onSettings?: () => void;
  footer?: ReactNode;
  labels?: Partial<InboxLabels>;
  theme?: Theme;
  /** Panel width (number in px or any CSS length). Defaults to `380`. */
  width?: number | string;
  className?: string;
}

export function NotificationPopover({
  open,
  onClose,
  anchorRef,
  inbox,
  placement = 'bottom-end',
  tabs,
  onSettings,
  footer,
  labels: labelOverrides,
  theme: themeProp,
  width = 380,
  className,
  ...listProps
}: NotificationPopoverProps) {
  const store = useInboxStore(inbox);
  const theme = useTheme(themeProp);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const labels = { ...DEFAULT_INBOX_LABELS, ...labelOverrides };
  const tabList = tabs === false ? null : (tabs ?? defaultTabs(labels));

  useEffect(() => {
    const panel = ref.current;
    const anchor = anchorRef.current;
    if (!open || !panel) return;
    const cleanups = [
      anchor ? autoPosition(anchor, panel, { placement }) : () => {},
      trapFocus(panel, { returnFocusTo: anchor }),
      onPointerOutside(() => [panel, anchorRef.current], onClose),
    ];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, [open, anchorRef, placement, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      className={cx('pingly-root pingly-popover', className)}
      data-theme={theme}
      style={{ width: typeof width === 'number' ? `${width}px` : width } as CSSProperties}
    >
      <InboxHeader titleId={titleId} labels={labels} inbox={store} onSettings={onSettings} />
      {tabList && <InboxTabs tabs={tabList} inbox={store} />}
      <NotificationList inbox={store} labels={labelOverrides} {...listProps} />
      {footer && <div className="pingly-panel-footer">{footer}</div>}
    </div>,
    document.body,
  );
}
