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

export function perMinute(times: number[], now: number, minutes: number): number[] {
  const bins = Array.from({ length: minutes }, () => 0);
  for (const t of times) {
    const m = Math.floor((now - t) / 60_000);
    if (m >= 0 && m < minutes) bins[minutes - 1 - m]++;
  }
  return bins;
}
