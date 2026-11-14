import { useEffect, useMemo } from 'react';
import { createFaviconBadge, type FaviconBadgeOptions } from './favicon-badge';
import { createTitleBadge, type TitleBadgeOptions } from './title-badge';

export interface DocumentBadgeOptions {
  /** Prefix the tab title with the count. Defaults to `true`. */
  title?: boolean | TitleBadgeOptions;
  /** Draw the count on the favicon. Defaults to `false`. */
  favicon?: boolean | FaviconBadgeOptions;
}

/** Mirror a count (usually unread notifications) into the tab title and favicon. */
export function useDocumentBadge(
  count: number,
  { title = true, favicon = false }: DocumentBadgeOptions = {},
): void {
  const titleBadge = useMemo(
    () => (title ? createTitleBadge(title === true ? {} : title) : null),
    [title],
  );
  const faviconBadge = useMemo(
    () => (favicon ? createFaviconBadge(favicon === true ? {} : favicon) : null),
    [favicon],
  );
  useEffect(() => {
    titleBadge?.set(count);
    void faviconBadge?.set(count);
  }, [count, titleBadge, faviconBadge]);
  useEffect(
    () => () => {
      titleBadge?.reset();
      faviconBadge?.reset();
    },
    [titleBadge, faviconBadge],
  );
}
