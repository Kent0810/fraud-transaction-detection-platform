import { useEffect, useState } from 'react';

import { vnd } from '../data/format';
import { useLive } from '../data/live';
import { href } from '../data/router';
import type { LiveAlert } from '../data/types';
import { RuleChip, VerdictBadge } from './Badges';

const SHOW_MS = 8_000;
const MAX = 4;

/** A card in the corner for each live alert; click to open the card. */
export function Toasts() {
  const { subscribe } = useLive();
  const [toasts, setToasts] = useState<LiveAlert[]>([]);

  useEffect(
    () =>
      subscribe((a) => {
        setToasts((prev) => [a, ...prev].slice(0, MAX));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t !== a)), SHOW_MS);
      }),
    [subscribe],
  );

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <a
          key={t.txnId}
          className={`toast t-${t.decision.toLowerCase()}`}
          href={href({ page: 'card', cardId: t.cardId })}
        >
          <div className="toast-head">
            <VerdictBadge verdict={t.decision} />
            <span className="mono">{t.cardId}</span>
          </div>
          <div className="toast-body">
            <strong>{t.merchant}</strong> · {vnd(t.amount)}
          </div>
          <div className="chips">
            {t.firedRules.map((r) => (
              <RuleChip key={r} ruleId={r} />
            ))}
          </div>
        </a>
      ))}
    </div>
  );
}
