import type { ReactNode } from 'react';
import type { EventRoutes } from './routes';
import type { EventFeed, EventMap } from './types';

/**
 * Type routes from a client's event map so every payload is checked:
 * `defineRoutes(client, { 'invoice.paid': { toast: (p) => ({ title: p.amount }) } })`.
 */
export function defineRoutes<E extends EventMap>(
  _client: EventFeed<E>,
  routes: EventRoutes<E, ReactNode>,
): EventRoutes<E, ReactNode> {
  return routes;
}
