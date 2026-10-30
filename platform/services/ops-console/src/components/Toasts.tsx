import { useEffect, useRef, useState } from 'react';

import { cardNumber, vnd } from '../data/format';
import { useLive } from '../data/live';
import { go } from '../data/router';
import type { LiveAlert } from '../data/types';
import { RuleChip, VerdictBadge } from './Badges';
import { Icon } from './Icons';

const SHOW_MS = 8_000;
const MAX = 4;

/** A card in the corner for each live alert; click to open the card, hover to keep it. */
export function Toasts() {
  const { subscribe } = useLive();
  const [toasts, setToasts] = useState<LiveAlert[]>([]);

  useEffect(() => subscribe((a) => setToasts((prev) => [a, ...prev].slice(0, MAX))), [subscribe]);

  const dismiss = (a: LiveAlert) => setToasts((prev) => prev.filter((t) => t !== a));

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.txnId} alert={t} onDone={() => dismiss(t)} />
      ))}
    </div>
  );
}

function Toast({ alert, onDone }: { alert: LiveAlert; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(SHOW_MS);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const id = setTimeout(onDone, left.current);
    return () => {
      clearTimeout(id);
      left.current -= Date.now() - started;
    };
  }, [paused, onDone]);

  return (
    <div
      className={`toast t-${alert.decision.toLowerCase()}${paused ? ' paused' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="toast-main"
        onClick={() => {
          go({ page: 'card', cardId: alert.cardId });
          onDone();
        }}
      >
        <div className="toast-head">
          <VerdictBadge verdict={alert.decision} />
          <span className="mono muted">{cardNumber(alert.cardId)}</span>
        </div>
        <div className="toast-body">
          <strong>{alert.merchant}</strong>
          <span className="amount">{vnd(alert.amount)}</span>
        </div>
        <div className="chips">
          {alert.firedRules.map((r) => (
            <RuleChip key={r} ruleId={r} />
          ))}
        </div>
      </button>
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDone}>
        <Icon name="x" size={14} />
      </button>
      <span className="toast-timer" style={{ animationDuration: `${SHOW_MS}ms` }} />
    </div>
  );
}
