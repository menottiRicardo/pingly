import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useConfig } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { moveFocus } from '../shared/focus';
import { ICONS } from '../shared/icons';
import { groupByDay as groupDays } from '../shared/time';
import { groupNotifications, type NotificationGroup } from './grouping';
import type { AnyInbox } from './InboxContext';
import { DEFAULT_INBOX_LABELS, type InboxLabels } from './labels';
import { NotificationItem, type ActionHandler, type NavigateHandler } from './NotificationItem';
import type { Notification } from './types';
import { useInbox } from './useInbox';

export interface NotificationListProps {
  inbox?: AnyInbox;
  onNavigate?: NavigateHandler;
  onAction?: ActionHandler;
  /** Replace the default item. Receives the notification and any grouped ones. */
  renderItem?: (
    notification: Notification<ReactNode>,
    grouped: Notification<ReactNode>[],
  ) => ReactNode;
  /** Show "Today", "Yesterday"… headings. Defaults to `true`. */
  groupByDay?: boolean;
  /** Collapse notifications with the same `groupKey`. Defaults to `true`. */
  groupItems?: boolean;
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (selected: Set<string>) => void;
  showArchive?: boolean;
  emptyState?: ReactNode;
  labels?: Partial<InboxLabels>;
  className?: string;
}

export function NotificationList({
  inbox,
  onNavigate,
  onAction,
  renderItem,
  groupByDay = true,
  groupItems = true,
  selectable = false,
  selected,
  onSelectedChange,
  showArchive,
  emptyState,
  labels: labelOverrides,
  className,
}: NotificationListProps) {
  const { store, notifications, status, hasMore, loadingMore } = useInbox(inbox);
  const { locale } = useConfig();
  const labels = { ...DEFAULT_INBOX_LABELS, ...labelOverrides };
  const sentinel = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo<NotificationGroup<ReactNode, unknown>[]>(
    () =>
      groupItems
        ? groupNotifications(notifications)
        : notifications.map((n) => ({ key: n.id, latest: n, items: [n] })),
    [notifications, groupItems],
  );
  const sections = useMemo(
    () =>
      groupByDay
        ? groupDays(groups, (g) => g.latest.createdAt, { locale })
        : [{ key: 'all', label: '', items: groups }],
    [groups, groupByDay, locale],
  );

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void store.loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [store, hasMore, notifications.length]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      !listRef.current ||
      (event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End')
    )
      return;
    const items = [...listRef.current.querySelectorAll<HTMLElement>('.pingly-item-main')];
    if (items.includes(document.activeElement as HTMLElement)) moveFocus(event, items);
  };

  if (notifications.length === 0) {
    if (status === 'loading' || status === 'idle') {
      return (
        <div className={cx('pingly-feed', className)} aria-busy="true">
          <span className="pingly-visually-hidden">{labels.loading}</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="pingly-skeleton" aria-hidden="true">
              <span />
              <span />
            </div>
          ))}
        </div>
      );
    }
    if (status === 'error') {
      return (
        <div className={cx('pingly-feed pingly-feed-state', className)} role="alert">
          <p className="pingly-state-title">{labels.error}</p>
          <button type="button" className="pingly-button" onClick={() => void store.load()}>
            {labels.retry}
          </button>
        </div>
      );
    }
    return (
      <div className={cx('pingly-feed pingly-feed-state', className)}>
        {emptyState ?? (
          <>
            <span
              className="pingly-state-icon"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: ICONS.inbox }}
            />
            <p className="pingly-state-title">{labels.empty}</p>
            <p className="pingly-state-text">{labels.emptyDescription}</p>
          </>
        )}
      </div>
    );
  }

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onSelectedChange?.(next);
  };

  return (
    <div ref={listRef} className={cx('pingly-feed', className)} onKeyDown={onKeyDown}>
      {sections.map((section) => (
        <section
          key={section.key}
          className="pingly-feed-section"
          aria-label={section.label || undefined}
        >
          {section.label && (
            <h3 className="pingly-feed-heading" aria-hidden="true">
              {section.label}
            </h3>
          )}
          <ul className="pingly-feed-list">
            {section.items.map((group) => {
              const [first, ...rest] = group.items;
              const n = group.latest;
              if (renderItem) return <li key={group.key}>{renderItem(n, rest)}</li>;
              const ids = group.items.map((i) => i.id);
              return (
                <NotificationItem
                  key={group.key}
                  notification={first ?? n}
                  grouped={rest}
                  inbox={store}
                  onNavigate={onNavigate}
                  onAction={onAction}
                  selectable={selectable}
                  selected={ids.every((id) => selected?.has(id))}
                  onSelectedChange={(on) => toggle(ids, on)}
                  showArchive={showArchive}
                  labels={labelOverrides}
                />
              );
            })}
          </ul>
        </section>
      ))}
      {hasMore && (
        <div ref={sentinel} className="pingly-feed-more">
          {typeof IntersectionObserver === 'undefined' ? (
            <button
              type="button"
              className="pingly-button"
              onClick={() => void store.loadMore()}
              disabled={loadingMore}
            >
              {labels.loading}
            </button>
          ) : (
            loadingMore && (
              <span className="pingly-spinner" role="status" aria-label={labels.loading} />
            )
          )}
        </div>
      )}
    </div>
  );
}
