import { EVENT_TYPES, type AppEvents, type EventType } from './events';
import { PEOPLE } from './seed';
import { server } from './server';

const POSTS = [
  { id: 'q3', title: 'Q3 planning' },
  { id: 'design', title: 'Design review notes' },
  { id: 'launch', title: 'Launch checklist' },
];
const COMMENTS = [
  'Looks great, shipping it!',
  'Can we sync on this tomorrow?',
  'Left a few notes inline.',
  '+1 from me',
];
const DEVICES = ['Safari on iPhone', 'Firefox on Windows', 'Chrome on Android'];
const PLACES = ['Lisbon, PT', 'São Paulo, BR', 'Berlin, DE', 'Austin, US'];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/** A plausible payload for any event type. */
export function samplePayload<K extends EventType>(type: K): AppEvents[K] {
  const person = pick(PEOPLE);
  const samples: AppEvents = {
    'comment.created': (() => {
      const post = pick(POSTS);
      return {
        postId: post.id,
        postTitle: post.title,
        author: person.name,
        avatar: person.avatar,
        text: pick(COMMENTS),
      };
    })(),
    'invoice.paid': {
      invoiceId: `INV-${1000 + Math.floor(Math.random() * 9000)}`,
      amount: Math.round(Math.random() * 90_000) / 100 + 10,
      currency: 'USD',
    },
    'deploy.finished': {
      project: pick(['web-app', 'api', 'docs']),
      status: Math.random() > 0.3 ? 'success' : 'failed',
      durationMs: Math.round(20_000 + Math.random() * 60_000),
    },
    mention: {
      author: person.name,
      avatar: person.avatar,
      channel: pick(['#general', '#design', '#launch']),
    },
    'security.alert': { device: pick(DEVICES), location: pick(PLACES) },
  };
  return samples[type];
}

/** Publish one random event from the fake server. */
export function publishRandom() {
  const type = pick(EVENT_TYPES);
  return server.publish(type, samplePayload(type));
}
