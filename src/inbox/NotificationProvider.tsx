import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationClient } from '../realtime/client';
import { ClientContext } from '../realtime/ClientContext';
import { bridgeEvents, type BridgeOptions, type EventRoutes } from '../realtime/routes';
import type { EventMap } from '../realtime/types';
import type { Theme } from '../shared/config';
import { ConfigContext } from '../shared/ConfigContext';
import { toast } from '../toast/instance';
import type { AnyInbox } from './InboxContext';
import { InboxContext } from './InboxContext';
import { createInbox } from './instance';

export interface NotificationProviderProps<E extends EventMap = EventMap> {
  /** The inbox to share. Defaults to a new in-memory inbox. */
  inbox?: AnyInbox;
  /** Realtime client whose events flow into the inbox and toasts. */
  client?: NotificationClient<E, EventMap>;
  /** How each realtime event type becomes a notification and/or toast. */
  routes?: EventRoutes<E, ReactNode>;
  /** Return `false` to suppress a realtime delivery. */
  shouldDeliver?: BridgeOptions<E, ReactNode>['shouldDeliver'];
  /** Default theme for every pingly component inside. */
  theme?: Theme;
  /** Locale for dates and relative times. */
  locale?: string | string[];
  /** Load the first page right away. Defaults to `true`. */
  loadOnMount?: boolean;
  children?: ReactNode;
}

export function NotificationProvider<E extends EventMap = EventMap>({
  inbox,
  client,
  routes,
  shouldDeliver,
  theme,
  locale,
  loadOnMount = true,
  children,
}: NotificationProviderProps<E>) {
  const [fallback] = useState(() => (inbox ? null : createInbox()));
  const store = inbox ?? fallback!;
  const config = useMemo(() => ({ theme, locale }), [theme, locale]);
  const latest = useRef({ routes, shouldDeliver });
  useEffect(() => {
    latest.current = { routes, shouldDeliver };
  });

  useEffect(() => {
    if (loadOnMount && store.getSnapshot().status === 'idle') void store.load();
  }, [store, loadOnMount]);

  useEffect(() => {
    if (!client) return;
    // Routes are read lazily so inline objects don't resubscribe every render.
    const routesProxy = new Proxy({} as EventRoutes<E, ReactNode>, {
      get: (_, key) => latest.current.routes?.[key as keyof E],
    });
    return bridgeEvents<E, ReactNode>(client, {
      inbox: store,
      routes: routesProxy,
      onToast: ({ title, ...options }) => {
        toast(title, options);
      },
      shouldDeliver: (...args) => latest.current.shouldDeliver?.(...args) ?? true,
    });
  }, [client, store]);

  return (
    <ConfigContext.Provider value={config}>
      <ClientContext.Provider
        value={(client as NotificationClient<EventMap, EventMap> | undefined) ?? null}
      >
        <InboxContext.Provider value={store}>{children}</InboxContext.Provider>
      </ClientContext.Provider>
    </ConfigContext.Provider>
  );
}
