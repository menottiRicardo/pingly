import { useMemo, useSyncExternalStore } from 'react';
import type { Theme } from '../shared/config';
import { cx } from '../shared/cx';
import { Banner } from './Banner';
import { bannerStore } from './instance';
import { selectBanners } from './store';

export interface BannerHostProps {
  /** Show banners targeted at this host. Leave unset for the default host. */
  id?: string;
  /** `top` or `bottom` of the page when `fixed`; otherwise renders in place. */
  position?: 'top' | 'bottom';
  /** Pin to the viewport edge. Defaults to `false` (renders in normal flow). */
  fixed?: boolean;
  /** How many banners to show at once. Defaults to `1`. */
  max?: number;
  dismissLabel?: string;
  theme?: Theme;
  className?: string;
}

/** Renders banners created with `banner.show()`, highest priority first. */
export function BannerHost({
  id,
  position = 'top',
  fixed = false,
  max = 1,
  dismissLabel,
  theme,
  className,
}: BannerHostProps) {
  const banners = useSyncExternalStore(
    bannerStore.subscribe,
    bannerStore.getSnapshot,
    bannerStore.getSnapshot,
  );
  const shown = useMemo(() => selectBanners(banners, id).slice(0, max), [banners, id, max]);
  if (shown.length === 0) return null;
  return (
    <div
      className={cx('pingly-banner-host', className)}
      data-position={position}
      data-fixed={fixed || undefined}
    >
      {shown.map((b) => (
        <Banner
          key={b.id}
          variant={b.variant}
          description={b.description}
          action={b.action}
          icon={b.icon}
          theme={theme}
          dismissLabel={dismissLabel}
          onDismiss={b.dismissible === false ? undefined : () => bannerStore.dismiss(b.id)}
        >
          {b.message}
        </Banner>
      ))}
    </div>
  );
}
