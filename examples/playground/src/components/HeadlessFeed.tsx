import { formatRelativeTime, useInbox } from 'pingly';

/** A completely custom feed built only from the `useInbox()` hook — no pingly markup. */
export function HeadlessFeed() {
  const { notifications, unreadCount, status, markRead, loadMore, hasMore, loadingMore } =
    useInbox();
  return (
    <div className="headless">
      <p className="muted small">
        {status === 'loading'
          ? 'Loading…'
          : `${unreadCount} unread · ${notifications.length} loaded`}
      </p>
      <ul>
        {notifications.slice(0, 8).map((n) => (
          <li key={n.id} data-unread={!n.readAt || undefined}>
            <button onClick={() => void markRead(n.id)} disabled={Boolean(n.readAt)}>
              {n.readAt ? '✓' : '●'}
            </button>
            <span>{n.title}</span>
            <small>{formatRelativeTime(n.createdAt)}</small>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
