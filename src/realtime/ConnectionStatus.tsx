import type { Theme } from '../shared/config';
import { useTheme } from '../shared/ConfigContext';
import { cx } from '../shared/cx';
import { DEFAULT_STATUS_LABELS } from './labels';
import type { ConnectionSource, ConnectionStatus as Status } from './types';
import { useConnectionStatus } from './useRealtime';

export interface ConnectionStatusProps {
  client?: ConnectionSource;
  labels?: Partial<Record<Status, string>>;
  /** Render nothing while connected. */
  hideWhenOpen?: boolean;
  /** Show a "Retry" button when disconnected. Defaults to `true`. */
  retry?: boolean;
  retryLabel?: string;
  theme?: Theme;
  className?: string;
}

/** A small live/offline indicator for the realtime connection. */
export function ConnectionStatus({
  client,
  labels,
  hideWhenOpen = false,
  retry = true,
  retryLabel = 'Retry',
  theme: themeProp,
  className,
}: ConnectionStatusProps) {
  const status = useConnectionStatus(client);
  const theme = useTheme(themeProp);
  if (hideWhenOpen && status === 'open') return null;
  const text = { ...DEFAULT_STATUS_LABELS, ...labels }[status];
  return (
    <span
      className={cx('pingly-root pingly-status', className)}
      data-theme={theme}
      data-status={status}
      role="status"
    >
      <span className="pingly-status-dot" aria-hidden="true" />
      {text}
      {retry && client && (status === 'closed' || status === 'offline') && (
        <button type="button" className="pingly-text-button" onClick={() => client.reconnect()}>
          {retryLabel}
        </button>
      )}
    </span>
  );
}
