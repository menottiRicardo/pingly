import type { InboxAdapter, InboxNotification, PreferencesAdapter, PreferenceValues } from 'pingly';
import { withChaos } from './chaos';
import { server } from './server';

type Title = InboxNotification['title'];

/**
 * The inbox API. Each call goes through the chaos knobs, then hits the fake
 * server's database — so failures, latency and rollbacks behave like the
 * real thing.
 */
export const inboxApi: InboxAdapter<Title> = {
  list: (params) => withChaos('loading notifications', () => server.db.list(params)),
  markRead: (ids) => withChaos('marking as read', () => server.db.markRead(ids)),
  markUnread: (ids) => withChaos('marking as unread', () => server.db.markUnread(ids)),
  markAllRead: () => withChaos('marking all as read', () => server.db.markAllRead()),
  archive: (ids) => withChaos('archiving', () => server.db.archive(ids)),
  unarchive: (ids) => withChaos('restoring', () => server.db.unarchive(ids)),
  remove: (ids) => withChaos('deleting', () => server.db.remove(ids)),
  unreadCount: () => withChaos('counting unread', () => server.db.unreadCount()),
};

let savedPreferences: PreferenceValues | null = null;

export const preferencesApi: PreferencesAdapter = {
  load: () => withChaos('loading preferences', () => savedPreferences),
  save: (values) =>
    withChaos('saving preferences', () => {
      savedPreferences = values;
    }),
};
