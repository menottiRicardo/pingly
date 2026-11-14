import { ICONS } from '../shared/icons';
import type { BannerVariant } from './types';

export const VARIANT_ICONS: Record<BannerVariant, string> = {
  info: ICONS.info,
  success: ICONS.success,
  warning: ICONS.warning,
  error: ICONS.error,
  neutral: ICONS.megaphone,
};

/** Errors and warnings interrupt screen readers; the rest are polite. */
export function variantRole(variant: BannerVariant): 'alert' | 'status' {
  return variant === 'error' || variant === 'warning' ? 'alert' : 'status';
}
