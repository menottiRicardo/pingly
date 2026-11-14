import type { InboxNotification } from 'pingly';
import type { AppEvents, EventType } from './events';

type Described = Omit<InboxNotification, 'id' | 'type' | 'createdAt'>;

/**
 * How each event reads in the inbox. The fake server stores the same shape
 * the client routes produce, the way a real backend would.
 */
export function describeEvent<K extends EventType>(type: K, payload: AppEvents[K]): Described {
  const p = payload as AppEvents[EventType];
  switch (type) {
    case 'comment.created': {
      const c = p as AppEvents['comment.created'];
      return {
        title: `${c.author} commented on ${c.postTitle}`,
        body: c.text,
        avatar: c.avatar,
        category: 'comments',
        groupKey: `post-${c.postId}`,
        url: `#/inbox?post=${c.postId}`,
        actions: [
          { id: 'reply', label: 'Reply', variant: 'primary' },
          { id: 'like', label: 'Like' },
        ],
      };
    }
    case 'invoice.paid': {
      const i = p as AppEvents['invoice.paid'];
      return {
        title: `Invoice ${i.invoiceId} was paid`,
        body: formatMoney(i.amount, i.currency),
        category: 'billing',
      };
    }
    case 'deploy.finished': {
      const d = p as AppEvents['deploy.finished'];
      return {
        title: d.status === 'success' ? `${d.project} deployed` : `${d.project} deploy failed`,
        body: `Took ${(d.durationMs / 1000).toFixed(1)}s`,
        category: 'deploys',
        actions:
          d.status === 'failed'
            ? [{ id: 'logs', label: 'View logs', variant: 'danger' }]
            : undefined,
      };
    }
    case 'mention': {
      const m = p as AppEvents['mention'];
      return {
        title: `${m.author} mentioned you in ${m.channel}`,
        avatar: m.avatar,
        category: 'mentions',
      };
    }
    default: {
      const s = p as AppEvents['security.alert'];
      return {
        title: 'New sign-in to your account',
        body: `${s.device} · ${s.location}`,
        category: 'security',
      };
    }
  }
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
}
