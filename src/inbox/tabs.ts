import type { InboxLabels } from './labels';
import type { InboxFilter } from './types';

export interface InboxTab<C = unknown> {
  id: string;
  label: C;
  filter: InboxFilter;
}

export function defaultTabs(labels: InboxLabels, withArchived = false): InboxTab<string>[] {
  const tabs: InboxTab<string>[] = [
    { id: 'all', label: labels.all, filter: { status: 'all' } },
    { id: 'unread', label: labels.unread, filter: { status: 'unread' } },
  ];
  if (withArchived)
    tabs.push({ id: 'archived', label: labels.archived, filter: { status: 'archived' } });
  return tabs;
}

export function sameFilter(a: InboxFilter, b: InboxFilter): boolean {
  return (a.status ?? 'all') === (b.status ?? 'all') && a.category === b.category;
}
