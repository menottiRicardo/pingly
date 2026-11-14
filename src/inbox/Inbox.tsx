import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import type { AnyInbox } from './InboxContext';
import { InboxHeader } from './InboxHeader';
import { InboxTabs } from './InboxTabs';
import { DEFAULT_INBOX_LABELS, type InboxLabels } from './labels';
import { NotificationList, type NotificationListProps } from './NotificationList';
import { defaultTabs, type InboxTab } from './tabs';
import type { InboxFilter } from './types';
import { useInbox } from './useInbox';

const EMPTY: ReadonlySet<string> = new Set();

export interface InboxProps extends Pick<
  NotificationListProps,
  'onNavigate' | 'onAction' | 'renderItem' | 'groupByDay' | 'emptyState'
> {
  inbox?: AnyInbox;
  /** Filter tabs. `false` hides them. Defaults to All / Unread / Archived. */
  tabs?: InboxTab<ReactNode>[] | false;
  onSettings?: () => void;
  labels?: Partial<InboxLabels>;
  theme?: Theme;
  className?: string;
}

/** Full-page notification inbox with filters and bulk actions. */
export function Inbox({
  inbox,
  tabs,
  onSettings,
  labels: labelOverrides,
  theme: themeProp,
  className,
  ...listProps
}: InboxProps) {
  const { store, notifications, filter } = useInbox(inbox);
  const theme = useTheme(themeProp);
  const titleId = useId();
  const labels = { ...DEFAULT_INBOX_LABELS, ...labelOverrides };
  const tabList = tabs === false ? null : (tabs ?? defaultTabs(labels, true));
  // Selection belongs to one filter; switching tabs starts a fresh one.
  const [selection, setSelection] = useState<{ filter: InboxFilter; ids: Set<string> }>(() => ({
    filter,
    ids: new Set(),
  }));
  const selected = selection.filter === filter ? selection.ids : EMPTY;
  const setSelected = (ids: Set<string>) => setSelection({ filter, ids });

  useEffect(() => {
    if (store.getSnapshot().status === 'idle') void store.load();
  }, [store]);

  const visibleIds = notifications.map((n) => n.id);
  const ids = [...selected].filter((id) => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && ids.length === visibleIds.length;
  const archivedView = filter.status === 'archived';
  const run = (action: (ids: string[]) => Promise<void>) => {
    void action(ids);
    setSelected(new Set());
  };

  return (
    <section
      className={cx('pingly-root pingly-inbox', className)}
      data-theme={theme}
      aria-labelledby={titleId}
    >
      <InboxHeader titleId={titleId} labels={labels} inbox={store} onSettings={onSettings} />
      {tabList && <InboxTabs tabs={tabList} inbox={store} />}
      <div className="pingly-bulk" data-active={ids.length > 0 || undefined}>
        <label className="pingly-bulk-all">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = ids.length > 0 && !allSelected;
            }}
            disabled={visibleIds.length === 0}
            onChange={(event) =>
              setSelected(event.target.checked ? new Set(visibleIds) : new Set())
            }
          />
          {ids.length > 0 ? labels.selected(ids.length) : labels.selectAll}
        </label>
        {ids.length > 0 && (
          <span className="pingly-bulk-actions">
            <button
              type="button"
              className="pingly-button"
              onClick={() => run((x) => store.markRead(x))}
            >
              {labels.markRead}
            </button>
            <button
              type="button"
              className="pingly-button"
              onClick={() => run((x) => store.markUnread(x))}
            >
              {labels.markUnread}
            </button>
            <button
              type="button"
              className="pingly-button"
              onClick={() => run((x) => (archivedView ? store.unarchive(x) : store.archive(x)))}
            >
              {archivedView ? labels.unarchive : labels.archive}
            </button>
            <button
              type="button"
              className="pingly-button"
              data-variant="danger"
              onClick={() => run((x) => store.remove(x))}
            >
              {labels.remove}
            </button>
          </span>
        )}
      </div>
      <NotificationList
        inbox={store}
        labels={labelOverrides}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        {...listProps}
      />
    </section>
  );
}
