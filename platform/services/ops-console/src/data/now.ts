import { useEffect, useState } from 'react';

/** The current time, refreshed every `everyMs` so relative times and rate windows move on their own. */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
