import { useSyncExternalStore } from 'react';

export const ROUTES = [
  { id: 'toasts', label: 'Toasts' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'realtime', label: 'Realtime' },
  { id: 'banners', label: 'Banners & alerts' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'browser', label: 'Browser' },
] as const;

export type RouteId = (typeof ROUTES)[number]['id'];

function parse(): { route: RouteId; query: URLSearchParams } {
  const [path = '', search = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const route = ROUTES.some((r) => r.id === path) ? (path as RouteId) : 'toasts';
  return { route, query: new URLSearchParams(search) };
}

let current = parse();
const subscribe = (listener: () => void) => {
  const onChange = () => {
    current = parse();
    listener();
  };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** Tiny hash router: `#/inbox?post=1`. */
export function useRoute() {
  return useSyncExternalStore(subscribe, () => current);
}

export function navigate(route: RouteId, query?: Record<string, string>) {
  const search = query ? `?${new URLSearchParams(query)}` : '';
  window.location.hash = `/${route}${search}`;
}
