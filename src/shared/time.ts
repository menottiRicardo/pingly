export type DateInput = string | number | Date;

export function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export interface TimeOptions {
  now?: number;
  locale?: string | string[];
}

/** "now", "5 minutes ago", "in 2 hours", "last week"… */
export function formatRelativeTime(
  input: DateInput,
  { now = Date.now(), locale }: TimeOptions = {},
): string {
  const seconds = (toDate(input).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 45) return rtf.format(0, 'second');
  for (const [unit, size] of UNITS) {
    if (abs >= size * 0.95) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), 'minute');
}

export function formatDateTime(input: DateInput, locale?: string | string[]): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    toDate(input),
  );
}

function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function capitalize(text: string, locale?: string | string[]): string {
  const first = Array.isArray(locale) ? locale[0] : locale;
  return text.charAt(0).toLocaleUpperCase(first) + text.slice(1);
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/** Group items (already sorted newest first) under "Today", "Yesterday" or a date. */
export function groupByDay<T>(
  items: readonly T[],
  getDate: (item: T) => DateInput,
  { now = Date.now(), locale }: TimeOptions = {},
): DayGroup<T>[] {
  const today = startOfDay(now);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const date = toDate(getDate(item));
    const day = startOfDay(date.getTime());
    const diffDays = Math.round((today - day) / 86_400_000);
    const key = new Date(day).toISOString().slice(0, 10);
    let group = groups.get(key);
    if (!group) {
      const label =
        diffDays === 0 || diffDays === 1
          ? capitalize(rtf.format(-diffDays, 'day'), locale)
          : new Intl.DateTimeFormat(locale, {
              month: 'short',
              day: 'numeric',
              year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
            }).format(date);
      group = { key, label, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}
