import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { Theme } from '../shared/config';
import { ConfigContext } from '../shared/ConfigContext';
import type { AnyInbox } from './InboxContext';
import { InboxContext } from './InboxContext';
import { createInbox } from './instance';

export interface NotificationProviderProps {
  /** The inbox to share. Defaults to a new in-memory inbox. */
  inbox?: AnyInbox;
  /** Default theme for every pingly component inside. */
  theme?: Theme;
  /** Locale for dates and relative times. */
  locale?: string | string[];
  /** Load the first page right away. Defaults to `true`. */
  loadOnMount?: boolean;
  children?: ReactNode;
}

export function NotificationProvider({
  inbox,
  theme,
  locale,
  loadOnMount = true,
  children,
}: NotificationProviderProps) {
  const [fallback] = useState(() => (inbox ? null : createInbox()));
  const store = inbox ?? fallback!;
  const config = useMemo(() => ({ theme, locale }), [theme, locale]);

  useEffect(() => {
    if (loadOnMount && store.getSnapshot().status === 'idle') void store.load();
  }, [store, loadOnMount]);

  return (
    <ConfigContext.Provider value={config}>
      <InboxContext.Provider value={store}>{children}</InboxContext.Provider>
    </ConfigContext.Provider>
  );
}
