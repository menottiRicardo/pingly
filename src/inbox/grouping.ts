import type { Notification } from './types';

export interface NotificationGroup<C, P> {
  key: string;
  /** Newest notification in the group; shown as the group's face. */
  latest: Notification<C, P>;
  items: Notification<C, P>[];
}

/**
 * Collapse notifications sharing a `groupKey` into one entry, placed where
 * its newest item is. Notifications without a key stay on their own.
 */
export function groupNotifications<C, P>(
  list: readonly Notification<C, P>[],
): NotificationGroup<C, P>[] {
  const groups: NotificationGroup<C, P>[] = [];
  const byKey = new Map<string, NotificationGroup<C, P>>();
  for (const n of list) {
    if (!n.groupKey) {
      groups.push({ key: n.id, latest: n, items: [n] });
      continue;
    }
    const existing = byKey.get(n.groupKey);
    if (existing) existing.items.push(n);
    else {
      const group = { key: `group:${n.groupKey}`, latest: n, items: [n] };
      byKey.set(n.groupKey, group);
      groups.push(group);
    }
  }
  return groups;
}
