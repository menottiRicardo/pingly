export type BannerVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface BannerAction<C = unknown> {
  label: C;
  onClick: () => void;
  /** Link instead of a button. */
  href?: string;
}

export interface BannerOptions<C = unknown> {
  id?: string;
  variant?: BannerVariant;
  description?: C;
  action?: BannerAction<C>;
  /** Defaults to `true`. */
  dismissible?: boolean;
  /** Remember dismissal (in localStorage) under this key so the banner never comes back. */
  dismissKey?: string;
  /** Higher shows first. Defaults to `0`. */
  priority?: number;
  /** Only show from this time. */
  startsAt?: string | number | Date;
  /** Stop showing after this time. */
  endsAt?: string | number | Date;
  /** Replace the variant icon. `null` hides it. */
  icon?: C | null;
  /** Target a specific `<BannerHost id>`. */
  hostId?: string;
  onDismiss?: () => void;
}

export interface BannerData<C = unknown> extends Omit<BannerOptions<C>, 'id' | 'variant'> {
  id: string;
  message: C;
  variant: BannerVariant;
  createdAt: number;
}
