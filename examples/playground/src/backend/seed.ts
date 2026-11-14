import type { InboxNotification } from 'pingly';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const PEOPLE = [
  { name: 'Ana Souza', avatar: 'https://i.pravatar.cc/80?img=47' },
  { name: 'Leo Martins', avatar: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Maya Chen', avatar: 'https://i.pravatar.cc/80?img=32' },
  { name: 'Sam Okafor', avatar: 'https://i.pravatar.cc/80?img=53' },
];

export function seedNotifications(): InboxNotification[] {
  return [
    {
      id: 's1',
      type: 'comment.created',
      title: 'Ana Souza commented on Q3 planning',
      body: '"Can we move the beta to week 3?"',
      avatar: PEOPLE[0]!.avatar,
      category: 'comments',
      groupKey: 'post-q3',
      createdAt: ago(4),
      actions: [
        { id: 'reply', label: 'Reply', variant: 'primary' },
        { id: 'like', label: 'Like' },
      ],
    },
    {
      id: 's2',
      type: 'comment.created',
      title: 'Leo Martins commented on Q3 planning',
      avatar: PEOPLE[1]!.avatar,
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
      type: 'security.alert',
      title: 'New sign-in to your account',
      body: 'Chrome on macOS · Lisbon, PT',
      category: 'security',
      createdAt: ago(60 * 5),
    },
    {
      id: 's5',
      type: 'deploy.finished',
      title: 'web-app deployed',
      body: 'Took 48.2s',
      category: 'deploys',
      createdAt: ago(60 * 26),
      readAt: ago(60 * 20),
    },
    ...Array.from({ length: 30 }, (_, i): InboxNotification => ({
      id: `old-${i}`,
      type: 'mention',
      title: `Maya Chen mentioned you in #design (${i + 1})`,
      avatar: PEOPLE[2]!.avatar,
      category: 'mentions',
      createdAt: ago(60 * 24 * (2 + i)),
      readAt: i > 2 ? ago(60 * 24 * (2 + i)) : null,
      archivedAt: i % 9 === 8 ? ago(60 * 24) : null,
    })),
  ];
}
