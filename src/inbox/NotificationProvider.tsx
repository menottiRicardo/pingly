import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSound, type SoundOptions } from '../browser/sound';
import { notify, type SystemNotificationOptions } from '../browser/system';
import { useDocumentBadge, type DocumentBadgeOptions } from '../browser/useDocumentBadge';
import type { PreferencesStore } from '../preferences/store';
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
import type { Notification } from './types';
import { useUnreadCount } from './useInbox';

export interface PreferenceChannels {
  /** Channel checked before storing in the inbox. Defaults to `inApp`. */
  inbox?: string;
  /** Channel checked before showing a toast. Defaults to `inApp`. */
  toast?: string;
  /** Channel checked before OS notifications and sounds. Defaults to `browser`. */
  system?: string;
}

const textOf = (node: ReactNode) =>
  typeof node === 'string' || typeof node === 'number' ? String(node) : '';

export interface NotificationProviderProps<E extends EventMap = EventMap> {
  /** The inbox to share. Defaults to a new in-memory inbox. */
  inbox?: AnyInbox;
  /** Realtime client whose events flow into the inbox and toasts. */
  client?: NotificationClient<E, EventMap>;
  /** How each realtime event type becomes a notification and/or toast. */
  routes?: EventRoutes<E, ReactNode>;
  /** Return `false` to suppress a realtime delivery. */
  shouldDeliver?: BridgeOptions<E, ReactNode>['shouldDeliver'];
  /** User preferences; checked before every delivery. Quiet hours hold back toasts, sounds and OS notifications. */
  preferences?: PreferencesStore<ReactNode>;
  /** Which preference channels each delivery uses. */
  preferenceChannels?: PreferenceChannels;
  /** Show OS notifications for new inbox items while the tab is hidden (needs permission). */
  systemNotifications?:
    boolean | Omit<SystemNotificationOptions, 'title' | 'body' | 'tag' | 'data'>;
  /** Play a sound for new inbox items. */
  sound?: boolean | SoundOptions;
  /** Mirror the unread count into the tab title / favicon. */
  documentBadge?: boolean | DocumentBadgeOptions;
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
  preferences,
  preferenceChannels,
  systemNotifications = false,
  sound = false,
  documentBadge = false,
  theme,
  locale,
  loadOnMount = true,
  children,
}: NotificationProviderProps<E>) {
  const [fallback] = useState(() => (inbox ? null : createInbox()));
  const store = inbox ?? fallback!;
  const config = useMemo(() => ({ theme, locale }), [theme, locale]);
  const channels = { inbox: 'inApp', toast: 'inApp', system: 'browser', ...preferenceChannels };
  const latest = useRef({
    routes,
    shouldDeliver,
    preferences,
    channels,
    systemNotifications,
    sound,
  });
  useEffect(() => {
    latest.current = { routes, shouldDeliver, preferences, channels, systemNotifications, sound };
  });
  const unread = useUnreadCount(store);
  useDocumentBadge(
    unread,
    documentBadge === true ? {} : documentBadge === false ? { title: false } : documentBadge,
  );
  const player = useMemo(() => (sound ? createSound(sound === true ? {} : sound) : null), [sound]);

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
      shouldDeliver: (envelope, channel, notification) => {
        const { shouldDeliver: custom, preferences: prefs, channels: ch } = latest.current;
        if (custom?.(envelope, channel, notification) === false) return false;
        if (!prefs) return true;
        const category = notification?.category;
        return channel === 'inbox'
          ? prefs.allows(category, ch.inbox)
          : prefs.allows(category, ch.toast, { interruptive: true });
      },
    });
  }, [client, store]);

  // OS notifications and sounds for anything new in the inbox, from any source.
  useEffect(
    () =>
      store.events.on('received', (items) => {
        const { preferences: prefs, channels: ch, systemNotifications: system } = latest.current;
        const allowed = (n: Notification<ReactNode>) =>
          !prefs || prefs.allows(n.category, ch.system, { interruptive: true });
        const audible = items.filter(allowed);
        if (audible.length && player) void player.play();
        if (!system) return;
        for (const n of audible) {
          const title = textOf(n.title);
          if (!title) continue;
          void notify({
            ...(system === true ? {} : system),
            title,
            body: textOf(n.body) || undefined,
            icon: n.avatar,
            tag: n.id,
            data: { id: n.id, url: n.url },
          });
        }
      }),
    [store, player],
  );

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
