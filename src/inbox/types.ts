import type { DateInput } from '../shared/time';

export interface NotificationAction<C = unknown> {
  id: string;
  label: C;
  variant?: 'primary' | 'secondary' | 'danger';
}

/** A notification stored in the inbox. `C` is the content type for titles and labels. */
export interface Notification<C = unknown, P = unknown> {
  id: string;
  /** Your own notification kind, e.g. `comment.created`. */
  type: string;
  title: C;
  body?: C;
  createdAt: DateInput;
  readAt?: DateInput | null;
  archivedAt?: DateInput | null;
  /** Used by category tabs and preferences. */
  category?: string;
  /** Image URL shown next to the notification. */
  avatar?: string;
  /** Where clicking the notification should go. */
  url?: string;
  actions?: NotificationAction<C>[];
  /** Notifications with the same key are shown as one group. */
  groupKey?: string;
  /** Any extra data you need when rendering or handling it. */
  payload?: P;
}

export type InboxStatusFilter = 'all' | 'unread' | 'archived';

export interface InboxFilter {
  /** `all` = everything not archived. Defaults to `all`. */
  status?: InboxStatusFilter;
  category?: string;
}

export interface InboxPage<C = unknown, P = unknown> {
  items: Notification<C, P>[];
  /** Cursor for the next page; `null` or missing when there are no more. */
  nextCursor?: string | null;
  /** Total unread count, when the backend knows it. */
  unreadCount?: number;
}

export interface ListParams {
  cursor: string | null;
  filter: InboxFilter;
  limit: number;
  signal?: AbortSignal;
}

/** Connects the inbox to where notifications are stored. Only `list` is required. */
export interface InboxAdapter<C = unknown, P = unknown> {
  list(params: ListParams): Promise<InboxPage<C, P>>;
  markRead?(ids: string[]): Promise<void>;
  markUnread?(ids: string[]): Promise<void>;
  markAllRead?(): Promise<void>;
  archive?(ids: string[]): Promise<void>;
  unarchive?(ids: string[]): Promise<void>;
  remove?(ids: string[]): Promise<void>;
  unreadCount?(): Promise<number>;
}

export type InboxStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface InboxState<C = unknown, P = unknown> {
  items: Readonly<Record<string, Notification<C, P>>>;
  /** All known ids, newest first. */
  order: readonly string[];
  filter: InboxFilter;
  status: InboxStatus;
  loadingMore: boolean;
  error: unknown;
  cursor: string | null;
  hasMore: boolean;
  /** Unread count reported by the backend, kept in sync optimistically. */
  serverUnread: number | null;
  /** When the last new notification arrived. */
  lastReceivedAt: number | null;
}

export type InboxMutation = 'read' | 'unread' | 'readAll' | 'archive' | 'unarchive' | 'remove';
