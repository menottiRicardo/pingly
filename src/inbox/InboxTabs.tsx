import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../shared/cx';
import { moveFocus } from '../shared/focus';
import type { AnyInbox } from './InboxContext';
import { sameFilter, type InboxTab } from './tabs';
import { useInboxState, useInboxStore } from './useInbox';

export interface InboxTabsProps {
  tabs: InboxTab<ReactNode>[];
  inbox?: AnyInbox;
  label?: string;
  className?: string;
}

/** Tabs that switch the inbox filter (All / Unread / categories…). */
export function InboxTabs({
  tabs,
  inbox,
  label = 'Filter notifications',
  className,
}: InboxTabsProps) {
  const store = useInboxStore(inbox);
  const { filter } = useInboxState(store);
  const active = tabs.find((t) => sameFilter(t.filter, filter))?.id ?? tabs[0]?.id;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    const next = moveFocus(event, items, 'horizontal');
    next?.click();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx('pingly-tabs', className)}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="pingly-tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!sameFilter(tab.filter, filter)) void store.setFilter(tab.filter);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
