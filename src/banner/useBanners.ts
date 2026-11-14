import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { bannerStore } from './instance';
import type { BannerData } from './types';

/** All banners in the store, including scheduled ones. */
export function useBanners(): readonly BannerData<ReactNode>[] {
  return useSyncExternalStore(
    bannerStore.subscribe,
    bannerStore.getSnapshot,
    bannerStore.getSnapshot,
  );
}
