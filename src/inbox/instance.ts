import type { ReactNode } from 'react';
import { InboxStore, type InboxOptions } from './store';
import type { Notification } from './types';

/** A notification whose title, body and labels are React nodes. */
export type InboxNotification<P = unknown> = Notification<ReactNode, P>;

/** Create a notification inbox store for React. */
export function createInbox<P = unknown>(
  options?: InboxOptions<ReactNode, P>,
): InboxStore<ReactNode, P> {
  return new InboxStore<ReactNode, P>(options);
}
