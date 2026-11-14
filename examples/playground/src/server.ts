import { createNotificationClient } from 'pingly';
import { createMockTransport } from 'pingly/testing';

/** Everything our pretend backend can push, fully typed end to end. */
export type AppEvents = {
  'comment.created': {
    postId: string;
    postTitle: string;
    author: string;
    avatar: string;
    text: string;
  };
  'invoice.paid': { invoiceId: string; amount: number; currency: string };
  'deploy.finished': { project: string; status: 'success' | 'failed' };
  mention: { author: string; avatar: string; channel: string };
};

export const server = createMockTransport<AppEvents>();
export const client = createNotificationClient<AppEvents>({
  transport: server.transport,
  reconnect: { initial: 800, max: 5000 },
});

const people = [
  { name: 'Ana Souza', avatar: 'https://i.pravatar.cc/80?img=47' },
  { name: 'Leo Martins', avatar: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Maya Chen', avatar: 'https://i.pravatar.cc/80?img=32' },
];
const posts = ['Q3 roadmap', 'Design review notes', 'Launch checklist'];
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
let n = 0;

/** Send one random event, as if the backend pushed it. */
export function pushRandomEvent() {
  if (client.getStatus() !== 'open') return;
  const person = pick(people);
  const id = `evt-${Date.now()}-${++n}`;
  switch (n % 4) {
    case 0:
      return server.emit(
        'comment.created',
        {
          postId: `p${n % 3}`,
          postTitle: pick(posts),
          author: person.name,
          avatar: person.avatar,
          text: 'Looks great, shipping it!',
        },
        { id },
      );
    case 1:
      return server.emit(
        'invoice.paid',
        {
          invoiceId: `INV-${1000 + n}`,
          amount: Math.round(Math.random() * 900) + 100,
          currency: 'USD',
        },
        { id },
      );
    case 2:
      return server.emit(
        'deploy.finished',
        { project: 'web-app', status: Math.random() > 0.3 ? 'success' : 'failed' },
        { id },
      );
    default:
      return server.emit(
        'mention',
        { author: person.name, avatar: person.avatar, channel: '#general' },
        { id },
      );
  }
}
