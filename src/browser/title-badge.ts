import { hasDom } from '../shared/env';

export interface TitleBadgeOptions {
  /** Build the title. Defaults to `(3) Original title`. */
  format?: (count: number, title: string) => string;
  /** Cap the number shown. Defaults to `99`. */
  max?: number;
}

const PREFIX = /^\(\d+\+?\)\s/;

/** Show an unread count in the browser tab title. */
export function createTitleBadge({ format, max = 99 }: TitleBadgeOptions = {}) {
  const render =
    format ??
    ((count: number, title: string) =>
      count > 0 ? `(${count > max ? `${max}+` : count}) ${title}` : title);
  let base: string | null = null;
  return {
    set(count: number) {
      if (!hasDom()) return;
      // Pick up title changes made by the app since our last update.
      const current = document.title.replace(PREFIX, '');
      if (base === null || current !== base) base = current;
      document.title = render(count, base);
    },
    reset() {
      if (!hasDom() || base === null) return;
      document.title = base;
      base = null;
    },
  };
}
