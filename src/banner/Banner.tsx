import type { ReactNode } from 'react';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { ICONS } from '../shared/icons';
import { VARIANT_ICONS, variantRole } from './icons';
import type { BannerAction, BannerVariant } from './types';

export interface BannerProps {
  variant?: BannerVariant;
  children: ReactNode;
  description?: ReactNode;
  action?: BannerAction<ReactNode>;
  /** Shows a close button when set. */
  onDismiss?: () => void;
  icon?: ReactNode | null;
  dismissLabel?: string;
  theme?: Theme;
  className?: string;
}

/** A full-width announcement bar. Use `<BannerHost>` + `banner.show()` for queued banners. */
export function Banner({
  variant = 'info',
  children,
  description,
  action,
  onDismiss,
  icon,
  dismissLabel = 'Dismiss',
  theme: themeProp,
  className,
}: BannerProps) {
  const theme = useTheme(themeProp);
  return (
    <div
      className={cx('pingly-root pingly-banner', className)}
      data-theme={theme}
      data-variant={variant}
      role={variantRole(variant)}
    >
      {icon === null ? null : icon !== undefined ? (
        <span className="pingly-banner-icon" aria-hidden="true">
          {icon}
        </span>
      ) : (
        <span
          className="pingly-banner-icon"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: VARIANT_ICONS[variant] }}
        />
      )}
      <div className="pingly-banner-content">
        <span className="pingly-banner-message">{children}</span>
        {description != null && <span className="pingly-banner-description">{description}</span>}
      </div>
      {action &&
        (action.href ? (
          <a className="pingly-banner-action" href={action.href} onClick={action.onClick}>
            {action.label}
          </a>
        ) : (
          <button type="button" className="pingly-banner-action" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
      {onDismiss && (
        <button
          type="button"
          className="pingly-icon-button pingly-banner-close"
          aria-label={dismissLabel}
          onClick={onDismiss}
          dangerouslySetInnerHTML={{ __html: ICONS.close }}
        />
      )}
    </div>
  );
}
