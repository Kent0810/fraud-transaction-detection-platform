import { useCallback, useEffect, useState } from 'react';

import { VerdictBadge } from '../components/Badges';
import { fetchQueue } from '../data/api';
import { ago, score, vnd } from '../data/format';
import { useLive } from '../data/live';
import { go } from '../data/router';
import type { QueueItem } from '../data/types';

// New cases reach Cassandra within seconds (BR1), so the queue polls at the same pace.
const REFRESH_MS = 5_000;

export function Queue() {
  const { alerts } = useLive();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchQueue());
      setError(null);
      setCheckedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const fresh = new Set(alerts.slice(0, 20).map((a) => a.cardId));

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Triage queue</h1>
          <p className="muted">One case per card, ranked by risk score × flagged amount. Today and yesterday.</p>
        </div>
        <p className="muted small">{checkedAt ? `Updated ${checkedAt.toLocaleTimeString('en-GB')}` : 'Loading…'}</p>
      </header>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && (
        <div className="empty">
          <p>No open cases.</p>
          <p className="muted small">A card gets a case when one of its payments is stepped up or declined.</p>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Card</th>
                <th className="num">Priority</th>
                <th className="num">Risk score</th>
                <th className="num">Flagged amount</th>
                <th className="num">Open alerts</th>
                <th>Last decision</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr
                  key={c.cardId}
                  className={`clickable${fresh.has(c.cardId) ? ' fresh' : ''}`}
                  onClick={() => go({ page: 'card', cardId: c.cardId })}
                >
                  <td className="muted">{i + 1}</td>
                  <td className="mono">{c.cardId}</td>
                  <td className="num strong">{Math.round(c.priority).toLocaleString('en-US')}</td>
                  <td className="num">{score(c.riskScore)}</td>
                  <td className="num">{vnd(c.amountSum)}</td>
                  <td className="num">{c.openAlerts}</td>
                  <td>
                    <VerdictBadge verdict={c.lastDecision} />
                  </td>
                  <td className="muted">{ago(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
