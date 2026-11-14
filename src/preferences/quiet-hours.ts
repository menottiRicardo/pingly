import type { QuietHours } from './types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/** Day of week and minutes since midnight at `date` in `timeZone`. */
export function zonedClock(date: Date, timeZone?: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Whether `date` falls inside the quiet hours window. Handles overnight ranges. */
export function isWithinQuietHours(quiet: QuietHours, date = new Date()): boolean {
  if (!quiet.enabled) return false;
  const start = minutes(quiet.start);
  const end = minutes(quiet.end);
  if (start === end) return false;
  const { day, minutes: now } = zonedClock(date, quiet.timeZone);
  const overnight = start > end;
  // After midnight in an overnight range, the window started the previous day.
  const windowDay = overnight && now < end ? (day + 6) % 7 : day;
  if (quiet.days && !quiet.days.includes(windowDay)) return false;
  return overnight ? now >= start || now < end : now >= start && now < end;
}
