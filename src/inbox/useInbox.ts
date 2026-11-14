import type { ReactNode } from 'react';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { InboxContext, type AnyInbox } from './InboxContext';
import type { InboxStore } from './store';
import type { InboxFilter, InboxState, Notification } from './types';

const noopSubscribe = () => () => {};

/** The inbox passed in, or the one from the nearest `<NotificationProvider>`. */
export function useInboxStore<P = unknown>(
  inbox?: InboxStore<ReactNode, P>,
): InboxStore<ReactNode, P> {
  const fromContext = useContext(InboxContext);
  const store = inbox ?? fromContext;
  if (!store) {
    throw new Error('pingly: render this inside <NotificationProvider> or pass an `inbox` prop.');
  }
  return store as InboxStore<ReactNode, P>;
}

/** Like `useInboxStore`, but returns `null` instead of throwing when there is none. */
export function useOptionalInboxStore(inbox?: AnyInbox): AnyInbox | null {
  const fromContext = useContext(InboxContext);
  return inbox ?? fromContext;
}

export function useInboxState<P = unknown>(
  inbox?: InboxStore<ReactNode, P>,
): InboxState<ReactNode, P> {
  const store = useInboxStore(inbox);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** Notifications matching the inbox's current filter, newest first. */
export function useNotifications<P = unknown>(
  inbox?: InboxStore<ReactNode, P>,
): Notification<ReactNode, P>[] {
  const store = useInboxStore(inbox);
  return useSyncExternalStore(store.subscribe, store.getVisible, store.getVisible);
}

export function useUnreadCount(inbox?: AnyInbox): number {
  const store = useOptionalInboxStore(inbox);
  const getCount = useCallback(() => store?.getUnreadCount() ?? 0, [store]);
  return useSyncExternalStore(store?.subscribe ?? noopSubscribe, getCount, getCount);
}

export function useNotification<P = unknown>(
  id: string,
  inbox?: InboxStore<ReactNode, P>,
): Notification<ReactNode, P> | undefined {
  const state = useInboxState(inbox);
  return state.items[id];
}

/** Everything a custom inbox UI needs: state plus bound actions. */
export function useInbox<P = unknown>(inbox?: InboxStore<ReactNode, P>) {
  const store = useInboxStore(inbox);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const notifications = useSyncExternalStore(store.subscribe, store.getVisible, store.getVisible);
  const unreadCount = useSyncExternalStore(
    store.subscribe,
    store.getUnreadCount,
    store.getUnreadCount,
  );
  return useMemo(
    () => ({
      store,
      notifications,
      unreadCount,
      status: state.status,
      error: state.error,
      filter: state.filter,
      hasMore: state.hasMore,
      loadingMore: state.loadingMore,
      reload: () => store.load(),
      loadMore: () => store.loadMore(),
      setFilter: (filter: InboxFilter) => store.setFilter(filter),
      markRead: (ids: string | string[]) => store.markRead(ids),
      markUnread: (ids: string | string[]) => store.markUnread(ids),
      markAllRead: () => store.markAllRead(),
      archive: (ids: string | string[]) => store.archive(ids),
      unarchive: (ids: string | string[]) => store.unarchive(ids),
      remove: (ids: string | string[]) => store.remove(ids),
    }),
    [store, state, notifications, unreadCount],
  );
}
