import type { MouseEvent, ReactNode } from 'react';
import { useId } from 'react';
import { useConfig } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { ICONS } from '../shared/icons';
import { formatDateTime, formatRelativeTime, toDate } from '../shared/time';
import { useNow } from '../shared/useNow';
import type { AnyInbox } from './InboxContext';
import { DEFAULT_INBOX_LABELS, type InboxLabels } from './labels';
import { isUnread } from './store';
import type { Notification } from './types';
import { useInboxStore } from './useInbox';

export type NavigateHandler = (notification: Notification<ReactNode>, event: MouseEvent) => void;
export type ActionHandler = (actionId: string, notification: Notification<ReactNode>) => void;

export interface NotificationItemProps {
  notification: Notification<ReactNode>;
  /** Other notifications collapsed under this one (same `groupKey`). */
  grouped?: Notification<ReactNode>[];
  inbox?: AnyInbox;
  /** Called when the notification is opened; use it for client-side routing. */
  onNavigate?: NavigateHandler;
  onAction?: ActionHandler;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Show the archive button. Defaults to `true`. */
  showArchive?: boolean;
  labels?: Partial<InboxLabels>;
  className?: string;
}

export function NotificationItem({
  notification: n,
  grouped = [],
  inbox,
  onNavigate,
  onAction,
  selectable = false,
  selected = false,
  onSelectedChange,
  showArchive = true,
  labels: labelOverrides,
  className,
}: NotificationItemProps) {
  const store = useInboxStore(inbox);
  const { locale } = useConfig();
  const now = useNow();
  const titleId = useId();
  const labels = { ...DEFAULT_INBOX_LABELS, ...labelOverrides };
  const all = [n, ...grouped];
  const ids = all.map((item) => item.id);
  const unread = all.some((item) => isUnread(item as Notification<unknown>));
  const archived = Boolean(n.archivedAt);

  const open = (event: MouseEvent) => {
    const unreadIds = all
      .filter((item) => isUnread(item as Notification<unknown>))
      .map((i) => i.id);
    if (unreadIds.length) void store.markRead(unreadIds);
    if (onNavigate) {
      event.preventDefault();
      onNavigate(n, event);
    }
  };

  const body = (
    <>
      <span className="pingly-item-avatar" aria-hidden="true">
        {n.avatar ? (
          <img src={n.avatar} alt="" />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: ICONS.bell }} />
        )}
      </span>
      <span className="pingly-item-body">
        <span id={titleId} className="pingly-item-title">
          {n.title}
        </span>
        {n.body != null && <span className="pingly-item-text">{n.body}</span>}
        <span className="pingly-item-meta">
          <time
            dateTime={toDate(n.createdAt).toISOString()}
            title={formatDateTime(n.createdAt, locale)}
          >
            {formatRelativeTime(n.createdAt, { now, locale })}
          </time>
          {grouped.length > 0 && (
            <span className="pingly-item-more">{labels.more(grouped.length)}</span>
          )}
        </span>
      </span>
      {unread && (
        <span className="pingly-item-dot">
          <span className="pingly-visually-hidden">{labels.unreadDot}</span>
        </span>
      )}
    </>
  );

  return (
    <li
      className={cx('pingly-item', className)}
      data-unread={unread || undefined}
      data-archived={archived || undefined}
      data-selected={selected || undefined}
      data-type={n.type}
      data-category={n.category}
    >
      {selectable && (
        <input
          type="checkbox"
          className="pingly-item-select"
          checked={selected}
          aria-labelledby={titleId}
          onChange={(event) => onSelectedChange?.(event.target.checked)}
        />
      )}
      {n.url ? (
        <a className="pingly-item-main" href={n.url} onClick={open}>
          {body}
        </a>
      ) : (
        <button type="button" className="pingly-item-main" onClick={open}>
          {body}
        </button>
      )}
      <span className="pingly-item-tools">
        <button
          type="button"
          className="pingly-icon-button"
          aria-label={unread ? labels.markRead : labels.markUnread}
          title={unread ? labels.markRead : labels.markUnread}
          onClick={() => void (unread ? store.markRead(ids) : store.markUnread(ids))}
          dangerouslySetInnerHTML={{ __html: unread ? ICONS.check : ICONS.bell }}
        />
        {showArchive && (
          <button
            type="button"
            className="pingly-icon-button"
            aria-label={archived ? labels.unarchive : labels.archive}
            title={archived ? labels.unarchive : labels.archive}
            onClick={() => void (archived ? store.unarchive(ids) : store.archive(ids))}
            dangerouslySetInnerHTML={{ __html: ICONS.archive }}
          />
        )}
      </span>
      {n.actions && n.actions.length > 0 && (
        <span className="pingly-item-actions">
          {n.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="pingly-button"
              data-variant={action.variant ?? 'secondary'}
              onClick={() => onAction?.(action.id, n)}
            >
              {action.label}
            </button>
          ))}
        </span>
      )}
    </li>
  );
}
