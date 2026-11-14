/** Server → client events. Declared once; everything downstream is typed from this. */
export type AppEvents = {
  'comment.created': {
    postId: string;
    postTitle: string;
    author: string;
    avatar: string;
    text: string;
  };
  'invoice.paid': { invoiceId: string; amount: number; currency: string };
  'deploy.finished': { project: string; status: 'success' | 'failed'; durationMs: number };
  mention: { author: string; avatar: string; channel: string };
  'security.alert': { device: string; location: string };
};

/** Client → server messages. Only the WebSocket transport can send. */
export type ClientMessages = {
  'presence.update': { status: 'online' | 'away' | 'busy' };
  'notification.ack': { id: string };
};

export type EventType = keyof AppEvents;

export const EVENT_TYPES = [
  'comment.created',
  'invoice.paid',
  'deploy.finished',
  'mention',
  'security.alert',
] as const satisfies readonly EventType[];
