import { cx } from '../shared/cx';
import type { AnyInbox } from './InboxContext';
import { formatBadge } from './labels';
import { useUnreadCount } from './useInbox';

export interface UnreadBadgeProps {
  /** Count to show. Defaults to the inbox's unread count. */
  count?: number;
  inbox?: AnyInbox;
  /** Show `max+` above this number. Defaults to `99`. */
  max?: number;
  /** Show a small dot instead of the number. */
  dot?: boolean;
  /** Render even when the count is zero. */
  showZero?: boolean;
  className?: string;
}

export function UnreadBadge({
  count,
  inbox,
  max = 99,
  dot = false,
  showZero = false,
  className,
}: UnreadBadgeProps) {
  const unread = useUnreadCount(inbox);
  const value = count ?? unread;
  if (value <= 0 && !showZero) return null;
  return (
    <span className={cx('pingly-badge', className)} data-dot={dot || undefined} aria-hidden="true">
      {dot ? null : formatBadge(value, max)}
    </span>
  );
}
