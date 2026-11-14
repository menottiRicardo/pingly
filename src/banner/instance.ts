import type { ReactNode } from 'react';
import { BannerStore } from './store';
import type { BannerOptions } from './types';

/** The shared store every `<BannerHost>` renders from. */
export const bannerStore = new BannerStore<ReactNode>();

export const banner = {
  show: (message: ReactNode, options?: BannerOptions<ReactNode>) =>
    bannerStore.show(message, options),
  info: (message: ReactNode, options?: Omit<BannerOptions<ReactNode>, 'variant'>) =>
    bannerStore.show(message, { ...options, variant: 'info' }),
  success: (message: ReactNode, options?: Omit<BannerOptions<ReactNode>, 'variant'>) =>
    bannerStore.show(message, { ...options, variant: 'success' }),
  warning: (message: ReactNode, options?: Omit<BannerOptions<ReactNode>, 'variant'>) =>
    bannerStore.show(message, { ...options, variant: 'warning' }),
  error: (message: ReactNode, options?: Omit<BannerOptions<ReactNode>, 'variant'>) =>
    bannerStore.show(message, { ...options, variant: 'error' }),
  update: (id: string, patch: Partial<BannerOptions<ReactNode>> & { message?: ReactNode }) =>
    bannerStore.update(id, patch),
  dismiss: (id: string) => bannerStore.dismiss(id),
  forget: (dismissKey: string) => bannerStore.forget(dismissKey),
  clear: () => bannerStore.clear(),
};
