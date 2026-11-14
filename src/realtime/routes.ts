import type { Notification } from '../inbox/types';
import type { InboxStore } from '../inbox/store';
import type { ToastOptions } from '../toast/types';
import type { NotificationClient } from './client';
import type { Envelope, EventMap } from './types';

/** What a realtime event should become in the inbox. `id`, `type` and `createdAt` are filled in when missing. */
export type NotificationDraft<C> = Omit<Notification<C>, 'id' | 'type' | 'createdAt'> &
  Partial<Pick<Notification<C>, 'id' | 'type' | 'createdAt'>>;

/** What a realtime event should show as a toast. */
export type ToastDraft<C> = Omit<ToastOptions<C>, 'id'> & { title: C };

export interface EventRoute<P, C> {
  /** Store the event in the inbox. Return `null` to skip. */
  notification?: (payload: P, envelope: Envelope) => NotificationDraft<C> | null;
  /** Show the event as a toast. Return `null` to skip. */
  toast?: (payload: P, envelope: Envelope) => ToastDraft<C> | null;
}

/** Per-event-type instructions, fully typed from the client's event map. */
export type EventRoutes<E extends EventMap, C> = { [K in keyof E]?: EventRoute<E[K], C> };

export interface BridgeOptions<E extends EventMap, C> {
  inbox?: InboxStore<C>;
  routes?: EventRoutes<E, C>;
  /** Called for each toast draft; the bridge itself never renders anything. */
  onToast?: (draft: ToastDraft<C>, envelope: Envelope<E>) => void;
  /** Called after a notification is added to the inbox. */
  onNotification?: (notification: Notification<C>, envelope: Envelope<E>) => void;
  /** Return `false` to suppress a delivery (preferences, quiet hours…). */
  shouldDeliver?: (
    envelope: Envelope<E>,
    channel: 'inbox' | 'toast',
    notification?: Notification<C>,
  ) => boolean;
}

let counter = 0;

function looksLikeNotification(value: unknown): value is NotificationDraft<unknown> {
  return typeof value === 'object' && value !== null && 'title' in value;
}

/** Turn a draft into a full notification, filling the gaps from the envelope. */
export function toNotification<C>(
  draft: NotificationDraft<C>,
  envelope: Envelope,
): Notification<C> {
  return {
    ...draft,
    id: draft.id ?? envelope.id ?? `rt-${Date.now()}-${++counter}`,
    type: draft.type ?? envelope.type,
    createdAt: draft.createdAt ?? envelope.createdAt ?? new Date().toISOString(),
    payload: draft.payload ?? envelope.payload,
  };
}

/**
 * Route events from a client into an inbox and toasts. Events without a
 * route are stored when their payload already looks like a notification.
 * Returns a function that stops the bridge.
 */
export function bridgeEvents<E extends EventMap, C>(
  client: NotificationClient<E, EventMap>,
  { inbox, routes, onToast, onNotification, shouldDeliver }: BridgeOptions<E, C>,
): () => void {
  return client.onAny((envelope) => {
    const route = routes?.[envelope.type] as EventRoute<unknown, C> | undefined;
    const draft = route?.notification
      ? route.notification(envelope.payload, envelope)
      : !route && looksLikeNotification(envelope.payload)
        ? (envelope.payload as NotificationDraft<C>)
        : null;
    const notification = draft ? toNotification(draft, envelope) : undefined;
    if (notification && inbox && shouldDeliver?.(envelope, 'inbox', notification) !== false) {
      inbox.receive(notification);
      onNotification?.(notification, envelope);
    }
    const toastDraft = route?.toast?.(envelope.payload, envelope);
    if (toastDraft && onToast && shouldDeliver?.(envelope, 'toast', notification) !== false) {
      onToast(toastDraft, envelope);
    }
  });
}

/** Identity helper that types routes from a client's event map. */
export function defineEventRoutes<E extends EventMap, C>(
  _client: NotificationClient<E, EventMap>,
  routes: EventRoutes<E, C>,
): EventRoutes<E, C> {
  return routes;
}
