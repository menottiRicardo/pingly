import { createContext } from 'react';
import type { NotificationClient } from './client';
import type { EventMap } from './types';

export const ClientContext = createContext<NotificationClient<EventMap, EventMap> | null>(null);
