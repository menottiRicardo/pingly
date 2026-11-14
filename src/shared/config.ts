export type Theme = 'light' | 'dark' | 'system';

/** Defaults shared by every component below a `<NotificationProvider>`. */
export interface PinglyConfig {
  theme?: Theme;
  /** Locale(s) for dates and relative times. Defaults to the browser locale. */
  locale?: string | string[];
}
