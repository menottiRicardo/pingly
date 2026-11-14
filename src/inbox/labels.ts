export interface InboxLabels {
  title: string;
  markAllRead: string;
  settings: string;
  all: string;
  unread: string;
  archived: string;
  empty: string;
  emptyDescription: string;
  error: string;
  retry: string;
  loading: string;
  markRead: string;
  markUnread: string;
  archive: string;
  unarchive: string;
  remove: string;
  unreadDot: string;
  selectAll: string;
  close: string;
  bell: (unread: number) => string;
  selected: (count: number) => string;
  more: (count: number) => string;
  newArrivals: (count: number) => string;
}

export const DEFAULT_INBOX_LABELS: InboxLabels = {
  title: 'Notifications',
  markAllRead: 'Mark all as read',
  settings: 'Notification settings',
  all: 'All',
  unread: 'Unread',
  archived: 'Archived',
  empty: "You're all caught up",
  emptyDescription: 'New notifications will show up here.',
  error: "Couldn't load notifications",
  retry: 'Try again',
  loading: 'Loading notifications',
  markRead: 'Mark as read',
  markUnread: 'Mark as unread',
  archive: 'Archive',
  unarchive: 'Move to inbox',
  remove: 'Delete',
  unreadDot: 'Unread',
  selectAll: 'Select all',
  close: 'Close',
  bell: (unread) => (unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'),
  selected: (count) => `${count} selected`,
  more: (count) => `+${count} more`,
  newArrivals: (count) => (count === 1 ? '1 new notification' : `${count} new notifications`),
};

export function formatBadge(count: number, max: number): string {
  return count > max ? `${max}+` : String(count);
}
