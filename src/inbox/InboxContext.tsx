import { createContext } from 'react';
import type { ReactNode } from 'react';
import type { InboxStore } from './store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload type varies per app
export type AnyInbox = InboxStore<ReactNode, any>;

export const InboxContext = createContext<AnyInbox | null>(null);
