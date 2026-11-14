import type { ReactNode } from 'react';
import { useState } from 'react';
import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { ICONS } from '../shared/icons';
import { safeStorage } from '../shared/storage';
import { usePermission } from './usePermission';

export interface PermissionPromptLabels {
  title: string;
  description: string;
  enable: string;
  later: string;
}

export interface PermissionPromptProps {
  /** Remember "Not now" under this storage key. Defaults to `pingly-permission-prompt`. */
  storageKey?: string | false;
  labels?: Partial<PermissionPromptLabels>;
  icon?: ReactNode;
  onResult?: (permission: NotificationPermission | 'unsupported') => void;
  theme?: Theme;
  className?: string;
}

const DEFAULT_LABELS: PermissionPromptLabels = {
  title: 'Turn on desktop notifications?',
  description: "We'll let you know about new activity even when this tab is in the background.",
  enable: 'Turn on',
  later: 'Not now',
};

/**
 * A friendly ask shown before the browser's own permission prompt, so
 * people understand why. Hidden once permission is decided or dismissed.
 */
export function PermissionPrompt({
  storageKey = 'pingly-permission-prompt',
  labels: labelOverrides,
  icon,
  onResult,
  theme: themeProp,
  className,
}: PermissionPromptProps) {
  const theme = useTheme(themeProp);
  const { permission, request } = usePermission();
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const [dismissed, setDismissed] = useState(() =>
    Boolean(storageKey && safeStorage()?.getItem(storageKey)),
  );
  if (permission !== 'default' || dismissed) return null;

  const later = () => {
    if (storageKey) safeStorage()?.setItem(storageKey, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      className={cx('pingly-root pingly-permission', className)}
      data-theme={theme}
      role="dialog"
      aria-label={labels.title}
    >
      <span className="pingly-permission-icon" aria-hidden="true">
        {icon ?? <span dangerouslySetInnerHTML={{ __html: ICONS.bell }} />}
      </span>
      <div className="pingly-permission-content">
        <p className="pingly-permission-title">{labels.title}</p>
        <p className="pingly-permission-text">{labels.description}</p>
        <div className="pingly-permission-actions">
          <button
            type="button"
            className="pingly-button"
            data-variant="primary"
            onClick={async () => onResult?.(await request())}
          >
            {labels.enable}
          </button>
          <button type="button" className="pingly-button" onClick={later}>
            {labels.later}
          </button>
        </div>
      </div>
    </div>
  );
}
