import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { VerdictBadge } from '../components/Badges';
import { BarList, type Bucket, ScoreMeter, type Series, Spark, StackedColumns } from '../components/Charts';
import { Icon } from '../components/Icons';
import { fetchFlaggedPayments, fetchQueue } from '../data/api';
import { ago, cardNumber, compactVnd } from '../data/format';
import { useHotkeys } from '../data/hotkeys';
import { useLive } from '../data/live';
import { useNow } from '../data/now';
import { go } from '../data/router';
import { ruleTitle } from '../data/rules';
import type { FlaggedPayment, QueueItem, Verdict } from '../data/types';

// New cases reach Cassandra within seconds (BR1), so the queue polls at the same pace.
const REFRESH_MS = 5_000;

const TREND_HOURS = 24;
const HOUR_MS = 3_600_000;

const SERIES: Series[] = [
  { key: 'ALLOW', label: 'Alert only', color: 'var(--c-allow)' },
  { key: 'STEP_UP', label: 'Step-up', color: 'var(--c-step)' },
  { key: 'DECLINE', label: 'Decline', color: 'var(--c-decline)' },
];

type DecisionFilter = 'ALL' | Exclude<Verdict, 'ALLOW'>;

export function Queue() {
  const { alerts, markSeen } = useLive();
  const now = useNow(1_000);
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [flaggedPayments, setFlaggedPayments] = useState<FlaggedPayment[] | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [decision, setDecision] = useState<DecisionFilter>('ALL');
  const [cursor, setCursor] = useState(0);
  const body = useRef<HTMLTableSectionElement>(null);

  const load = useCallback(async () => {
    try {
      const [queue, flagged] = await Promise.all([fetchQueue(), fetchFlaggedPayments()]);
      setItems(queue);
      setFlaggedPayments(flagged);
      setError(null);
      setCheckedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Paused: the rows and charts hold still while an analyst reads them. Resuming loads straight away.
  const paused = pausedAt !== null;
  useEffect(() => {
    if (paused) return;
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load, paused]);

  useEffect(() => {
    if (!paused) markSeen();
  }, [alerts, markSeen, paused]);

  const waiting = pausedAt === null ? 0 : alerts.filter((a) => a.receivedAt > pausedAt).length;

  const trendAt = pausedAt ?? now;
  const hourlyStart = Math.floor(trendAt / HOUR_MS) * HOUR_MS - (TREND_HOURS - 1) * HOUR_MS;
  const buckets = useMemo<Bucket[]>(() => {
    const list: Bucket[] = Array.from({ length: TREND_HOURS }, (_, i) => {
      const at = new Date(hourlyStart + i * HOUR_MS);
      const label = at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return { label, detail: `Hour from ${label}`, values: { ALLOW: 0, STEP_UP: 0, DECLINE: 0 } };
    });
    for (const p of flaggedPayments ?? []) {
      const i = Math.floor((new Date(p.ts).getTime() - hourlyStart) / HOUR_MS);
      if (i >= 0 && i < TREND_HOURS) list[i].values[p.decision]++;
    }
    return list;
  }, [flaggedPayments, hourlyStart]);

  const ruleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of flaggedPayments ?? []) for (const r of p.firedRules) counts.set(r, (counts.get(r) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [flaggedPayments]);

  const rows = useMemo(() => {
    const digits = filter.replace(/\s/g, '');
    return (items ?? []).filter(
      (c) => (!digits || c.cardId.includes(digits)) && (decision === 'ALL' || c.lastDecision === decision),
    );
  }, [items, filter, decision]);

  const safeCursor = Math.min(cursor, Math.max(rows.length - 1, 0));

  useHotkeys({
    j: () => setCursor((c) => Math.min(c + 1, rows.length - 1)),
    k: () => setCursor((c) => Math.max(c - 1, 0)),
    ArrowDown: () => setCursor((c) => Math.min(c + 1, rows.length - 1)),
    ArrowUp: () => setCursor((c) => Math.max(c - 1, 0)),
    Enter: () => rows[safeCursor] && go({ page: 'card', cardId: rows[safeCursor].cardId }),
  });

  useEffect(() => {
    body.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [safeCursor]);

  const all = items ?? [];
  const maxPriority = Math.max(...all.map((c) => c.priority), 1);
  const fresh = new Set(alerts.filter((a) => now - a.receivedAt < 60_000).map((a) => a.cardId));
  const declines = all.filter((c) => c.lastDecision === 'DECLINE').length;
  const openAlerts = all.reduce((n, c) => n + c.openAlerts, 0);
  const nextIn = checkedAt ? Math.max(0, Math.ceil((REFRESH_MS - (now - checkedAt)) / 1000)) : null;

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Triage queue</h1>
          <p className="muted">One case per card, ranked by risk score × flagged amount, across today and yesterday.</p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className={`btn small ${paused ? 'primary' : 'ghost'}`}
            onClick={() => setPausedAt((p) => (p === null ? Date.now() : null))}
          >
            <Icon name={paused ? 'play' : 'pause'} size={14} />
            {paused ? 'Resume' : 'Pause'}
          </button>
          <div className={`refresh${error ? ' bad' : ''}`} title="The queue refreshes every 5 seconds">
            <svg viewBox="0 0 20 20" aria-hidden>
              <circle cx="10" cy="10" r="8" className="ring-track" />
              <circle
                cx="10"
                cy="10"
                r="8"
                className="ring"
                style={{ strokeDashoffset: nextIn === null ? 0 : (50.3 * nextIn) / (REFRESH_MS / 1000) }}
              />
            </svg>
            {paused
              ? 'Paused'
              : error
                ? 'Refresh failed, retrying'
                : checkedAt
                  ? `Updated ${ago(new Date(checkedAt).toISOString())}`
                  : 'Loading…'}
          </div>
        </div>
      </header>

      <div className="kpis">
        <Kpi label="Open cases" value={items ? String(all.length) : '—'} sub={`${declines} last declined`} />
        <Kpi label="Open alerts" value={items ? String(openAlerts) : '—'} sub="across all cases" tone="hl" />
        <Kpi
          label={`Flagged · last ${TREND_HOURS} h`}
          value={flaggedPayments ? String(flaggedPayments.length) : '—'}
          sub="payments, from stored alerts"
          tone="ctrl"
        >
          <Spark values={buckets.map((b) => b.values.ALLOW + b.values.STEP_UP + b.values.DECLINE)} />
        </Kpi>
      </div>

      <div className="trends">
        <div className="panel">
          <h2>Flagged per hour</h2>
          <StackedColumns
            buckets={buckets}
            series={SERIES}
            format={(n) => String(Math.round(n))}
            axisEvery={6}
            height={120}
            caption={`Flagged payments per hour over the last ${TREND_HOURS} hours`}
          />
        </div>
        <div className="panel">
          <h2>Rules firing</h2>
          <BarList
            empty="No rules have fired yet."
            rows={ruleCounts.map(([r, n]) => ({
              key: r,
              label: (
                <>
                  <b className="mono">{r}</b> {ruleTitle(r)}
                </>
              ),
              value: n,
            }))}
          />
        </div>
      </div>

      {error && <p className="error banner">{error}</p>}

      {waiting > 0 && (
        <button type="button" className="new-banner" onClick={() => setPausedAt(null)}>
          <Icon name="arrow" size={14} style={{ transform: 'rotate(-90deg)' }} />
          {waiting} new {waiting === 1 ? 'alert' : 'alerts'} while paused, show them
        </button>
      )}

      <div className="toolbar">
        <label className="search-box">
          <Icon name="filter" size={15} />
          <input
            inputMode="numeric"
            placeholder="Filter by card number"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCursor(0);
            }}
          />
        </label>
        <div className="seg" role="group" aria-label="Last decision">
          {(['ALL', 'DECLINE', 'STEP_UP'] as DecisionFilter[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={decision === d}
              onClick={() => {
                setDecision(d);
                setCursor(0);
              }}
            >
              {d === 'ALL' ? 'All' : d === 'DECLINE' ? 'Declined' : 'Stepped up'}
              <span className="seg-n">{d === 'ALL' ? all.length : all.filter((c) => c.lastDecision === d).length}</span>
            </button>
          ))}
        </div>
        <span className="toolbar-hint muted small">
          <kbd>J</kbd>
          <kbd>K</kbd> to move, <kbd>Enter</kbd> to open
        </span>
      </div>

      {!items && !error && <SkeletonTable rows={6} />}

      {items && rows.length === 0 && (
        <div className="empty">
          <h3>{all.length === 0 ? 'No open cases' : 'Nothing matches these filters'}</h3>
          <p className="muted">
            {all.length === 0
              ? 'A card gets a case when one of its payments is stepped up or declined. New cases show up here within seconds.'
              : 'Clear the filter to see every case.'}
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-card">
          <table className="grid">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Card</th>
                <th>Priority</th>
                <th>Risk score</th>
                <th className="num">Open alerts</th>
                <th>Last decision</th>
                <th>Updated</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody ref={body}>
              {rows.map((c, i) => (
                <tr
                  key={c.cardId}
                  aria-selected={i === safeCursor}
                  className={`clickable${fresh.has(c.cardId) ? ' fresh' : ''}`}
                  onClick={() => go({ page: 'card', cardId: c.cardId })}
                  onMouseMove={() => setCursor(i)}
                >
                  <td className="num muted rank">{i + 1}</td>
                  <td className="mono nowrap">
                    {cardNumber(c.cardId)}
                    {fresh.has(c.cardId) && <span className="new-tag">new</span>}
                  </td>
                  <td>
                    <span className="prio">
                      <span className="prio-bar">
                        <span style={{ width: `${(c.priority / maxPriority) * 100}%` }} />
                      </span>
                      <b>{compactVnd(c.priority).replace(' đ', '')}</b>
                    </span>
                  </td>
                  <td>
                    <ScoreMeter value={c.riskScore} />
                  </td>
                  <td className="num">
                    <span className={`pill${c.openAlerts > 0 ? ' hot' : ''}`}>{c.openAlerts}</span>
                  </td>
                  <td>
                    <VerdictBadge verdict={c.lastDecision} />
                  </td>
                  <td className="muted nowrap">{ago(c.updatedAt)}</td>
                  <td className="go">
                    <Icon name="chevron" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Kpi({
  label,
  value,
  sub,
  tone,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'hl' | 'ctrl' | 'ok';
  children?: ReactNode;
}) {
  return (
    <div className={`kpi${tone ? ` k-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      {sub && <span className="kpi-sub">{sub}</span>}
      {children}
    </div>
  );
}

export function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="table-card skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <span style={{ width: '4%' }} />
          <span style={{ width: '22%' }} />
          <span style={{ width: '18%' }} />
          <span style={{ width: '14%' }} />
          <span style={{ width: '16%' }} />
        </div>
      ))}
    </div>
  );
}
