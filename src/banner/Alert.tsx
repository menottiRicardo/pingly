import type { ReactNode } from 'react';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { ICONS } from '../shared/icons';
import { VARIANT_ICONS, variantRole } from './icons';
import type { BannerVariant } from './types';

export interface AlertProps {
  variant?: BannerVariant;
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode | null;
  /** Buttons or links shown under the text. */
  actions?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Override the ARIA role. Defaults to `alert` for errors/warnings, else `status`. Use `none` for static content. */
  role?: 'alert' | 'status' | 'none';
  theme?: Theme;
  className?: string;
}

/** An inline callout for messages inside the page. */
export function Alert({
  variant = 'info',
  title,
  children,
  icon,
  actions,
  onDismiss,
  dismissLabel = 'Dismiss',
  role,
  theme: themeProp,
  className,
}: AlertProps) {
  const theme = useTheme(themeProp);
  const resolvedRole = role ?? variantRole(variant);
  return (
    <div
      className={cx('pingly-root pingly-alert', className)}
      data-theme={theme}
      data-variant={variant}
      role={resolvedRole === 'none' ? undefined : resolvedRole}
    >
      {icon === null ? null : icon !== undefined ? (
        <span className="pingly-alert-icon" aria-hidden="true">
          {icon}
        </span>
      ) : (
        <span
          className="pingly-alert-icon"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: VARIANT_ICONS[variant] }}
        />
      )}
      <div className="pingly-alert-content">
        {title != null && <div className="pingly-alert-title">{title}</div>}
        {children != null && <div className="pingly-alert-text">{children}</div>}
        {actions && <div className="pingly-alert-actions">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="pingly-icon-button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          dangerouslySetInnerHTML={{ __html: ICONS.close }}
        />
      )}
    </div>
  );
}
