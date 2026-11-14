import { useEffect, useState } from 'react';

/** Current time, refreshed every `interval` ms. Keeps relative times fresh. */
export function useNow(interval = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
