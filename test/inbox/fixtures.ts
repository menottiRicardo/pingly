import type { Notification } from '../../src/inbox/types';

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function make(
  id: string,
  overrides: Partial<Notification<string>> = {},
): Notification<string> {
  return {
    id,
    type: 'test',
    title: `Title ${id}`,
    createdAt: minutesAgo(Number(id) || 1),
    ...overrides,
  };
}
