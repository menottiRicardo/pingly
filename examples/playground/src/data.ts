import { createInbox, createPreferences, memoryAdapter, type InboxNotification } from 'pingly';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const seed: InboxNotification[] = [
  {
    id: 's1',
    type: 'comment.created',
    title: 'Ana Souza commented on Q3 roadmap',
    body: '"Can we move the beta to week 3?"',
    avatar: 'https://i.pravatar.cc/80?img=47',
    category: 'comments',
    groupKey: 'post-q3',
    createdAt: ago(4),
    actions: [
      { id: 'reply', label: 'Reply', variant: 'primary' },
      { id: 'view', label: 'View' },
    ],
  },
  {
    id: 's2',
    type: 'comment.created',
    title: 'Leo Martins commented on Q3 roadmap',
    avatar: 'https://i.pravatar.cc/80?img=12',
    category: 'comments',
    groupKey: 'post-q3',
    createdAt: ago(9),
  },
  {
    id: 's3',
    type: 'invoice.paid',
    title: 'Invoice INV-0981 was paid',
    body: '$420.00 from Acme Inc.',
    category: 'billing',
    createdAt: ago(60 * 3),
  },
  {
    id: 's4',
    type: 'deploy.finished',
    title: 'Deploy to production finished',
    category: 'deploys',
    createdAt: ago(60 * 26),
    readAt: ago(60 * 20),
  },
  ...Array.from({ length: 24 }, (_, i): InboxNotification => ({
    id: `old-${i}`,
    type: 'mention',
    title: `Maya Chen mentioned you in #design (${i + 1})`,
    avatar: 'https://i.pravatar.cc/80?img=32',
    category: 'mentions',
    createdAt: ago(60 * 24 * (2 + i)),
    readAt: ago(60 * 24 * (2 + i)),
  })),
];

export const adapter = memoryAdapter(seed, { latency: 350 });
export const inbox = createInbox({ adapter, pageSize: 10, syncTabs: true });

export const preferences = createPreferences({
  categories: [
    { id: 'comments', label: 'Comments', description: 'Replies and comments on your posts' },
    { id: 'mentions', label: 'Mentions', description: 'When someone @mentions you' },
    { id: 'billing', label: 'Billing', description: 'Invoices and payments', locked: ['email'] },
    {
      id: 'deploys',
      label: 'Deploys',
      description: 'Build and deploy results',
      channels: ['inApp', 'browser'],
    },
  ],
  channels: [
    { id: 'inApp', label: 'In-app' },
    { id: 'browser', label: 'Desktop' },
    { id: 'email', label: 'Email' },
  ],
});
