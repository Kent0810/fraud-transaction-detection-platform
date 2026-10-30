import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { stream } from './http';
import type { LiveAlert, ReceivedAlert } from './types';

const KEEP = 200;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000];
const PREFS_KEY = 'ops-console.alert-prefs';

export type Connection = 'connecting' | 'live' | 'offline';

export type AlertPrefs = {
  sound: boolean;
  desktop: boolean;
  declinesOnly: boolean;
};

type Live = {
  alerts: ReceivedAlert[];
  unseen: number;
  connection: Connection;
  prefs: AlertPrefs;
  setPrefs: (p: AlertPrefs) => void;
  markSeen: () => void;
  clear: () => void;
  subscribe: (fn: (a: LiveAlert) => void) => () => void;
};

const LiveContext = createContext<Live | null>(null);

function loadPrefs(): AlertPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { sound: false, desktop: false, declinesOnly: false, ...JSON.parse(raw) };
  } catch {
    // Defaults below.
  }
  return { sound: false, desktop: false, declinesOnly: false };
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // No audio: the toast still shows.
  }
}

/** Flagged payments as the fraud detector decides them, while a staff member is signed in. */
export function LiveAlertsProvider({ token, children }: { token: string; children: ReactNode }) {
  const [alerts, setAlerts] = useState<ReceivedAlert[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [prefs, setPrefsState] = useState<AlertPrefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  const listeners = useRef(new Set<(a: LiveAlert) => void>());

  const setPrefs = useCallback((p: AlertPrefs) => {
    prefsRef.current = p;
    setPrefsState(p);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      // Kept for this tab only.
    }
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    let attempt = 0;

    const receive = (a: LiveAlert) => {
      const p = prefsRef.current;
      if (p.declinesOnly && a.decision !== 'DECLINE') return;
      setAlerts((prev) => [{ ...a, receivedAt: Date.now() }, ...prev].slice(0, KEEP));
      setUnseen((n) => n + 1);
      listeners.current.forEach((fn) => fn(a));
      if (p.sound) beep();
      if (p.desktop && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(`${a.decision === 'DECLINE' ? 'Declined' : 'Step-up'} · ${a.merchant}`, {
          body: `Card ${a.cardId} · ${a.firedRules.join(', ')}`,
          tag: a.txnId,
        });
      }
    };

    (async () => {
      while (!abort.signal.aborted) {
        setConnection('connecting');
        try {
          await stream(
            '/ops/alerts/live',
            (type, data) => {
              if (type === 'alert') receive(JSON.parse(data) as LiveAlert);
            },
            () => {
              setConnection('live');
              attempt = 0;
            },
            abort.signal,
          );
        } catch {
          if (abort.signal.aborted) return;
        }
        setConnection('offline');
        await new Promise((r) => setTimeout(r, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]));
      }
    })();

    return () => abort.abort();
  }, [token]);

  const markSeen = useCallback(() => setUnseen(0), []);
  const clear = useCallback(() => {
    setAlerts([]);
    setUnseen(0);
  }, []);
  const subscribe = useCallback((fn: (a: LiveAlert) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo(
    () => ({ alerts, unseen, connection, prefs, setPrefs, markSeen, clear, subscribe }),
    [alerts, unseen, connection, prefs, setPrefs, markSeen, clear, subscribe],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): Live {
  const live = useContext(LiveContext);
  if (!live) throw new Error('useLive outside LiveAlertsProvider');
  return live;
}
