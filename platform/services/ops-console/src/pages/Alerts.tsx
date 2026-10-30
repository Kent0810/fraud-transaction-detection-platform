import { useEffect, useMemo, useState } from 'react';

import { RuleChip, VerdictBadge } from '../components/Badges';
import { BarList, type Bucket, type Series, StackedColumns } from '../components/Charts';
import { Icon, type IconName } from '../components/Icons';
import { cardNumber, category, clock, compactVnd, score, vnd } from '../data/format';
import { useLive } from '../data/live';
import { useNow } from '../data/now';
import { go } from '../data/router';
import { ruleTitle } from '../data/rules';

const WINDOW_MIN = 30;

const SERIES: Series[] = [
  { key: 'STEP_UP', label: 'Step-up', color: 'var(--c-step)' },
  { key: 'DECLINE', label: 'Decline', color: 'var(--c-decline)' },
];

export function Alerts() {
  const { alerts, connection, prefs, setPrefs, markSeen, clear } = useLive();
  const now = useNow(5_000);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [rule, setRule] = useState<string | null>(null);

  useEffect(() => {
    if (pausedAt === null) markSeen();
  }, [alerts, markSeen, pausedAt]);

  const shown = useMemo(
    () =>
      alerts.filter((a) => (pausedAt === null || a.receivedAt <= pausedAt) && (!rule || a.firedRules.includes(rule))),
    [alerts, pausedAt, rule],
  );
  const waiting = pausedAt === null ? 0 : alerts.filter((a) => a.receivedAt > pausedAt).length;

  const buckets = useMemo<Bucket[]>(() => {
    const start = now - WINDOW_MIN * 60_000;
    const list: Bucket[] = Array.from({ length: WINDOW_MIN }, (_, i) => {
      const at = start + (i + 1) * 60_000;
      const label = new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return { label, detail: `Minute to ${label}`, values: { STEP_UP: 0, DECLINE: 0 } };
    });
    for (const a of alerts) {
      const i = Math.floor((a.receivedAt - start) / 60_000);
      if (i >= 0 && i < WINDOW_MIN) list[i].values[a.decision]++;
    }
    return list;
  }, [alerts, now]);

  const ruleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) for (const r of a.firedRules) counts.set(r, (counts.get(r) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [alerts]);

  const merchants = useMemo(() => {
    const sums = new Map<string, number>();
    for (const a of alerts) sums.set(a.merchant, (sums.get(a.merchant) ?? 0) + a.amount);
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [alerts]);

  const declines = alerts.filter((a) => a.decision === 'DECLINE').length;

  async function toggleDesktop(on: boolean) {
    if (on && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    setPrefs({ ...prefs, desktop: on && 'Notification' in window && Notification.permission === 'granted' });
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Live alerts</h1>
          <p className="muted">
            Every payment the detector steps up or declines, the moment it is decided. Kept for this session only.
          </p>
        </div>
        <div className="head-actions">
          <span className={`conn c-${connection}`}>
            <span className={`dot c-${connection}`} />
            {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
          </span>
          <button
            type="button"
            className={`btn small ${pausedAt === null ? 'ghost' : 'primary'}`}
            onClick={() => setPausedAt((p) => (p === null ? Date.now() : null))}
          >
            <Icon name={pausedAt === null ? 'pause' : 'play'} size={14} />
            {pausedAt === null ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="btn small ghost" onClick={clear} disabled={alerts.length === 0}>
            <Icon name="trash" size={14} />
            Clear
          </button>
        </div>
      </header>

      <div className="alerts-layout">
        <div className="feed-col">
          <div className="toolbar">
            <Switch
              icon="ban"
              label="Declines only"
              checked={prefs.declinesOnly}
              onChange={(v) => setPrefs({ ...prefs, declinesOnly: v })}
            />
            <Switch
              icon="volume"
              label="Sound"
              checked={prefs.sound}
              onChange={(v) => setPrefs({ ...prefs, sound: v })}
            />
            <Switch
              icon="desktop"
              label="Desktop notice when hidden"
              checked={prefs.desktop}
              onChange={(v) => void toggleDesktop(v)}
            />
            {rule && (
              <button type="button" className="filter-tag" onClick={() => setRule(null)}>
                {rule} · {ruleTitle(rule)}
                <Icon name="x" size={12} />
              </button>
            )}
          </div>

          {waiting > 0 && (
            <button type="button" className="new-banner" onClick={() => setPausedAt(null)}>
              <Icon name="arrow" size={14} style={{ transform: 'rotate(-90deg)' }} />
              {waiting} new {waiting === 1 ? 'alert' : 'alerts'} while paused, show them
            </button>
          )}

          {shown.length === 0 ? (
            <div className="empty">
              <h3>{rule ? `No ${rule} alerts yet` : 'Listening for flagged payments'}</h3>
              <p className="muted">New alerts also pop up in the corner on every page.</p>
            </div>
          ) : (
            <ol className="feed">
              {shown.map((a) => (
                <li key={a.txnId} className={`feed-item t-${a.decision.toLowerCase()}`}>
                  <div
                    role="link"
                    tabIndex={0}
                    className="feed-row"
                    onClick={() => go({ page: 'card', cardId: a.cardId })}
                    onKeyDown={(e) => e.key === 'Enter' && go({ page: 'card', cardId: a.cardId })}
                  >
                    <span className="feed-time mono">{clock(a.receivedAt)}</span>
                    <span className="feed-main">
                      <span className="feed-top">
                        <VerdictBadge verdict={a.decision} />
                        <strong>{a.merchant}</strong>
                        <span className="muted small">{category(a.category)}</span>
                      </span>
                      <span className="feed-meta">
                        <span className="mono">{cardNumber(a.cardId)}</span>
                        <span>score {score(a.score)}</span>
                      </span>
                      <span className="chips">
                        {a.firedRules.map((r) => (
                          <RuleChip
                            key={r}
                            ruleId={r}
                            active={rule === r}
                            onClick={() => setRule(rule === r ? null : r)}
                          />
                        ))}
                      </span>
                    </span>
                    <span className="feed-amount">{vnd(a.amount)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="stats-col">
          <div className="panel">
            <h2>Flagged per minute</h2>
            <StackedColumns
              buckets={buckets}
              series={SERIES}
              format={(n) => String(Math.round(n))}
              axisEvery={10}
              height={120}
              caption={`Step-ups and declines per minute over the last ${WINDOW_MIN} minutes`}
            />
          </div>
          <div className="panel split">
            <div>
              <span className="kpi-label">This session</span>
              <b className="kpi-value">{alerts.length}</b>
            </div>
            <div>
              <span className="kpi-label">Declined</span>
              <b className="kpi-value">{declines}</b>
            </div>
            <div>
              <span className="kpi-label">Stepped up</span>
              <b className="kpi-value">{alerts.length - declines}</b>
            </div>
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
                active: rule === r,
                onClick: () => setRule(rule === r ? null : r),
              }))}
            />
          </div>
          <div className="panel">
            <h2>Top merchants by flagged amount</h2>
            <BarList
              empty="No merchants yet."
              format={compactVnd}
              rows={merchants.map(([m, v]) => ({ key: m, label: m, value: v }))}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function Switch({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: IconName;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden>
        <span />
      </span>
      <Icon name={icon} size={14} />
      {label}
    </label>
  );
}
