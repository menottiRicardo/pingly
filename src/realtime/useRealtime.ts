import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { NotificationClient } from './client';
import { ClientContext } from './ClientContext';
import type { ConnectionSource, ConnectionStatus, Envelope, EventMap } from './types';

/** The client from the nearest `<NotificationProvider client={…}>`. */
export function useNotificationClient<
  In extends EventMap = EventMap,
  Out extends EventMap = EventMap,
>(client?: NotificationClient<In, Out>): NotificationClient<In, Out> {
  const fromContext = useContext(ClientContext);
  const resolved = client ?? fromContext;
  if (!resolved)
    throw new Error('pingly: pass `client` to <NotificationProvider> or to this hook.');
  return resolved as unknown as NotificationClient<In, Out>;
}

const noop = () => () => {};
const idle = (): ConnectionStatus => 'idle';

/** Current connection status; re-renders when it changes. */
export function useConnectionStatus(client?: ConnectionSource): ConnectionStatus {
  const fromContext = useContext(ClientContext);
  const resolved: ConnectionSource | null = client ?? fromContext;
  return useSyncExternalStore(
    resolved?.subscribe ?? noop,
    resolved?.getStatus ?? idle,
    resolved?.getStatus ?? idle,
  );
}

/** Run `handler` for every event of one type. The latest handler is always used. */
export function useNotificationEvent<In extends EventMap, K extends keyof In & string>(
  type: K,
  handler: (payload: In[K], envelope: Extract<Envelope<In>, { type: K }>) => void,
  client?: NotificationClient<In, EventMap>,
): void {
  const resolved = useNotificationClient<In>(client);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(
    () => resolved.on(type, (payload, envelope) => ref.current(payload, envelope)),
    [resolved, type],
  );
}
