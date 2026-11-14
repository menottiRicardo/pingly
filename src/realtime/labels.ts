import type { ConnectionStatus } from './types';

export const DEFAULT_STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  open: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
  paused: 'Paused',
  closed: 'Disconnected',
};
