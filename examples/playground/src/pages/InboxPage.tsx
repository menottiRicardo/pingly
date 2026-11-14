import { Inbox, toast, type Notification } from 'pingly';
import type { ReactNode } from 'react';
import { HeadlessFeed } from '../components/HeadlessFeed';
import { Card, Row, Toggle } from '../components/Card';
import { usePersistentState } from '../persist';
import { navigate, useRoute } from '../router';

function CompactItem({
  n,
  grouped,
}: {
  n: Notification<ReactNode>;
  grouped: Notification<ReactNode>[];
}) {
  return (
    <div className="compact-item" data-unread={!n.readAt || undefined}>
      <span className="compact-dot" aria-hidden="true" />
      <span>{n.title}</span>
      {grouped.length > 0 && <span className="muted small">+{grouped.length}</span>}
    </div>
  );
}

export function InboxPage() {
  const { query } = useRoute();
  const [compact, setCompact] = usePersistentState('inbox-compact', false);
  const [byDay, setByDay] = usePersistentState('inbox-by-day', true);
  const post = query.get('post');

  return (
    <>
      {post && (
        <Card
          title={`Post: ${post}`}
          description="You got here by clicking a notification with a url."
        >
          <button onClick={() => navigate('inbox')}>Back to inbox</button>
        </Card>
      )}
      <Card
        title="Full-page inbox"
        description="Tabs, bulk actions, infinite scroll and optimistic updates. Turn on chaos to see rollbacks."
      >
        <Row>
          <Toggle
            label="Compact custom items (renderItem)"
            checked={compact}
            onChange={setCompact}
          />
          <Toggle label="Group by day" checked={byDay} onChange={setByDay} />
        </Row>
      </Card>
      <Inbox
        groupByDay={byDay}
        renderItem={compact ? (n, grouped) => <CompactItem n={n} grouped={grouped} /> : undefined}
        onAction={(action, n) => toast.info(`“${action}” on ${String(n.title)}`)}
        onSettings={() => navigate('preferences')}
      />
      <Card
        title="Headless"
        description="The same data rendered with your own markup through useInbox()."
      >
        <HeadlessFeed />
      </Card>
    </>
  );
}
