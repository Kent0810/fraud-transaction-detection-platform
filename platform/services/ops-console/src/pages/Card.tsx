import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { RuleChip, VerdictBadge } from '../components/Badges';
import { ReasonAction } from '../components/Reason';
import * as api from '../data/api';
import { useAuth } from '../data/auth';
import { accountNumber, ago, category, dateTime, score, vnd } from '../data/format';
import { useLive } from '../data/live';
import { ACTION_LABEL } from '../data/rules';
import type { Activity, AuditEntry, CardView, CaseAlert, RuleType } from '../data/types';

const RANGES = [7, 30, 90];

// The Cassandra sink and the outbox relay take a moment; re-read after a change or a live alert for this card.
const SETTLE_MS = 2_500;

export function Card({ cardId }: { cardId: string }) {
  const { session } = useAuth();
  const { subscribe } = useLive();
  const isAgent = session?.role === 'AGENT';

  const [view, setView] = useState<CardView | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const loadActivity = useCallback(async () => {
    const [a, log] = await Promise.all([api.fetchActivity(cardId, days), api.fetchAudit(cardId)]);
    setActivity(a);
    setAudit(log);
  }, [cardId, days]);

  const loadCard = useCallback(async () => {
    try {
      setView(await api.openCard(cardId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [cardId]);

  useEffect(() => {
    setView(null);
    setActivity(null);
    void loadCard();
  }, [loadCard]);

  useEffect(() => {
    loadActivity().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [loadActivity]);

  useEffect(
    () =>
      subscribe((a) => {
        if (a.cardId === cardId) setTimeout(() => void loadActivity(), SETTLE_MS);
      }),
    [subscribe, cardId, loadActivity],
  );

  const refreshSoon = useCallback(async () => {
    await loadActivity();
    setTimeout(() => {
      void loadActivity();
      void api.openCard(cardId).then(setView);
    }, SETTLE_MS);
  }, [cardId, loadActivity]);

  if (error && !view) return <p className="error">{error}</p>;
  if (!view) return <p className="muted">Opening card…</p>;

  const rules = new Map(view.controls.merchantRules.map((r) => [r.merchant, r.type]));
  const rows = (activity ?? []).filter((t) => !onlyFlagged || t.decision !== 'ALLOW' || t.alerts.length > 0);

  async function review(alert: CaseAlert, status: 'CONFIRMED' | 'CLEARED', reason: string | null) {
    await api.reviewAlert(cardId, alert, status, reason);
    await loadActivity();
  }

  async function rule(merchant: string, type: RuleType, reason: string | null) {
    await api.setMerchantRule(cardId, merchant, type, reason);
    await refreshSoon();
  }

  async function release(merchant: string, reason: string | null) {
    await api.releaseMerchant(cardId, merchant, reason);
    await refreshSoon();
  }

  async function freeze(frozen: boolean, reason: string | null) {
    const { frozen: now } = await api.setFrozen(cardId, frozen, reason);
    setView((v) => (v && v.account ? { ...v, account: { ...v.account, frozen: now } } : v));
    await loadActivity();
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="kicker mono">Card {view.cardId}</p>
          <h1>{view.holder.name}</h1>
          <p className="muted small">
            {[view.holder.city, view.holder.state].filter(Boolean).join(', ')} · {view.holder.email}
            {view.holder.dob && ` · born ${view.holder.dob}`}
          </p>
        </div>
        <p className="notice">Opening this file was recorded in the audit log.</p>
      </header>

      <div className="cards">
        <div className="panel">
          <h2>Account</h2>
          {view.account ? (
            <>
              <dl>
                <dt>Number</dt>
                <dd className="mono">{accountNumber(view.account.accountNumber)}</dd>
                <dt>Balance</dt>
                <dd>{vnd(view.account.balance)}</dd>
                <dt>Status</dt>
                <dd>
                  <span className={`status ${view.account.frozen ? 'frozen' : 'active'}`}>
                    {view.account.frozen ? 'Frozen' : 'Active'}
                  </span>
                </dd>
              </dl>
              {isAgent &&
                (view.account.frozen ? (
                  <ReasonAction label="Unfreeze" confirm="Unfreeze card" onRun={(r) => freeze(false, r)} />
                ) : (
                  <ReasonAction
                    label="Freeze card"
                    confirm="Freeze card"
                    tone="danger"
                    onRun={(r) => freeze(true, r)}
                  />
                ))}
            </>
          ) : (
            <p className="muted">No account.</p>
          )}
        </div>

        <div className="panel">
          <h2>Case</h2>
          {view.state ? (
            <dl>
              <dt>Risk score</dt>
              <dd>{score(view.state.riskScore)}</dd>
              <dt>Priority</dt>
              <dd>{Math.round(view.state.priority).toLocaleString('en-US')}</dd>
              <dt>Flagged amount</dt>
              <dd>{vnd(view.state.amountSum)}</dd>
              <dt>Open alerts</dt>
              <dd>{view.state.openAlerts}</dd>
              <dt>Last decision</dt>
              <dd>
                <VerdictBadge verdict={view.state.lastDecision} />{' '}
                <span className="muted">{ago(view.state.updatedAt)}</span>
              </dd>
            </dl>
          ) : (
            <p className="muted">No case for this card.</p>
          )}
        </div>

        <div className="panel">
          <h2>Merchant rules</h2>
          {view.controls.merchantRules.length === 0 && <p className="muted">None.</p>}
          <ul className="rules-list">
            {view.controls.merchantRules.map((r) => (
              <li key={r.merchant}>
                <span className={`rule-type ${r.type.toLowerCase()}`}>
                  {r.type === 'BLOCK' ? 'Blocked' : 'Allowed'}
                </span>
                <span className="grow">{r.merchant}</span>
                {isAgent && (
                  <ReasonAction label="Remove" confirm="Remove rule" onRun={(reason) => release(r.merchant, reason)} />
                )}
              </li>
            ))}
          </ul>
          {isAgent && <AddRule onAdd={rule} />}
          {view.controls.budget && (
            <p className="muted small">
              Cardholder budget: {vnd(view.controls.budget.limit)} per {view.controls.budget.period.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      <div className="section-head">
        <h2>Activity</h2>
        <div className="seg">
          {RANGES.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
        <label className="small">
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Flagged
          only
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {!activity && <p className="muted">Loading activity…</p>}
      {activity && rows.length === 0 && <p className="muted">Nothing in this period.</p>}
      {rows.length > 0 && (
        <div className="scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Time</th>
                <th>Merchant / recipient</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th>Decision</th>
                <th className="num">Score</th>
                <th>Rules and alerts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const open = t.alerts.filter((a) => a.status === 'OPEN');
                const merchantRule = rules.get(t.merchant);
                return (
                  <tr key={t.txnId} className={t.decision !== 'ALLOW' ? 'flagged' : undefined}>
                    <td className="muted nowrap">{dateTime(t.ts)}</td>
                    <td>
                      {t.merchant}
                      {t.channel === 'TRANSFER' && <div className="muted small mono">{t.counterpartyAccount}</div>}
                    </td>
                    <td className="muted">{category(t.category)}</td>
                    <td className="num">{vnd(t.amount)}</td>
                    <td>
                      <VerdictBadge verdict={t.decision} />
                    </td>
                    <td className="num">{score(t.score)}</td>
                    <td>
                      <div className="chips">
                        {t.alerts.length > 0
                          ? t.alerts.map((a) => <RuleChip key={a.alertId} ruleId={a.ruleId} status={a.status} />)
                          : t.firedRules.map((r) => <RuleChip key={r} ruleId={r} />)}
                      </div>
                    </td>
                    <td className="actions">
                      {open.length > 0 && (
                        <>
                          <ReasonAction
                            label="Confirm fraud"
                            confirm="Confirm"
                            tone="danger"
                            onRun={async (r) => {
                              for (const a of open) await review(a, 'CONFIRMED', r);
                            }}
                          />
                          <ReasonAction
                            label="Clear"
                            confirm="Clear alert"
                            onRun={async (r) => {
                              for (const a of open) await review(a, 'CLEARED', r);
                            }}
                          />
                        </>
                      )}
                      {isAgent && t.channel === 'CARD' && merchantRule !== 'BLOCK' && (
                        <ReasonAction
                          label="Block merchant"
                          confirm="Block"
                          tone="danger"
                          onRun={(r) => rule(t.merchant, 'BLOCK', r)}
                        />
                      )}
                      {isAgent && t.channel === 'CARD' && merchantRule !== 'ALLOW' && t.decision !== 'ALLOW' && (
                        <ReasonAction
                          label="Allow merchant"
                          confirm="Allow"
                          onRun={(r) => rule(t.merchant, 'ALLOW', r)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title">Audit trail</h2>
      {audit.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <ul className="audit">
          {audit.map((e) => (
            <li key={e.auditId}>
              <span className="muted nowrap">{dateTime(e.at)}</span>
              <span>
                <strong>{e.staffName}</strong> <span className="muted small">({e.staffRole.toLowerCase()})</span>{' '}
                {ACTION_LABEL[e.action] ?? e.action}
                {e.payload.merchant && <> · {e.payload.merchant}</>}
                {e.payload.reason && <span className="muted"> — “{e.payload.reason}”</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddRule({ onAdd }: { onAdd: (merchant: string, type: RuleType, reason: string | null) => Promise<void> }) {
  const [merchant, setMerchant] = useState('');
  const [type, setType] = useState<RuleType>('BLOCK');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd(merchant.trim(), type, reason.trim() || null);
      setMerchant('');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-rule" onSubmit={submit}>
      <input
        placeholder="Merchant name"
        value={merchant}
        maxLength={120}
        onChange={(e) => setMerchant(e.target.value)}
      />
      <select value={type} onChange={(e) => setType(e.target.value as RuleType)}>
        <option value="BLOCK">Block</option>
        <option value="ALLOW">Allow</option>
      </select>
      <input placeholder="Reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      <button className="btn small" disabled={busy || !merchant.trim()}>
        {busy ? 'Saving…' : 'Add rule'}
      </button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}
