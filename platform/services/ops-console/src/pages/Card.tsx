import { type FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { PostingBadge, RuleChip, VerdictBadge } from '../components/Badges';
import { type Bucket, Gauge, type Series, StackedColumns } from '../components/Charts';
import { Icon, type IconName } from '../components/Icons';
import { ReasonAction } from '../components/Reason';
import * as api from '../data/api';
import { useAuth } from '../data/auth';
import {
  accountNumber,
  ago,
  cardNumber,
  category,
  compactVnd,
  dateTime,
  initials,
  score,
  shortDateTime,
  vnd,
} from '../data/format';
import { useLive } from '../data/live';
import { ACTION_LABEL, ruleTitle } from '../data/rules';
import type { Activity, AuditEntry, CardView, CaseAlert, LoginStatus, RuleType } from '../data/types';
import { Kpi, SkeletonTable } from './Queue';

const RANGES = [7, 30, 90];

// The Cassandra sink and the outbox relay take a moment; re-read after a change or a live alert for this card.
const SETTLE_MS = 2_500;

const SERIES: Series[] = [
  { key: 'ALLOW', label: 'Allowed', color: 'var(--c-allow)' },
  { key: 'STEP_UP', label: 'Stepped up', color: 'var(--c-step)' },
  { key: 'DECLINE', label: 'Declined', color: 'var(--c-decline)' },
];

const AUDIT_ICON: Record<string, IconName> = {
  VIEW_CARDHOLDER: 'eye',
  BLOCK_MERCHANT: 'ban',
  ALLOW_MERCHANT: 'check',
  RELEASE_MERCHANT: 'x',
  FREEZE_CARD: 'snow',
  UNFREEZE_CARD: 'unlock',
  CONFIRM_ALERT: 'shield',
  CLEAR_ALERT: 'check',
  DISABLE_LOGIN: 'logout',
  RESTORE_LOGIN: 'unlock',
};

const LOGIN_LABEL: Record<LoginStatus, string> = {
  ACTIVE: 'Active',
  LOCKED: 'Locked',
  DISABLED: 'Turned off',
};

type Channel = 'ALL' | 'CARD' | 'TRANSFER';

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

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
  const [channel, setChannel] = useState<Channel>('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadActivity = useCallback(async () => {
    const [a, log] = await Promise.all([api.fetchActivity(cardId, days), api.fetchAudit(cardId)]);
    setActivity(a);
    setAudit(log);
  }, [cardId, days]);

  const loadCard = useCallback(async () => {
    try {
      const v = await api.openCard(cardId);
      setView(v);
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

  const buckets = useMemo<Bucket[]>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const index = new Map<string, number>();
    const list: Bucket[] = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      index.set(dayKey(d), i);
      return {
        label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        detail: d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }),
        values: { ALLOW: 0, STEP_UP: 0, DECLINE: 0 },
      };
    });
    // Spending only: money received isn't the card's risk.
    for (const t of activity ?? []) {
      if (t.direction === 'IN') continue;
      const i = index.get(dayKey(new Date(t.ts)));
      if (i !== undefined) list[i].values[t.decision] += t.amount;
    }
    return list;
  }, [activity, days]);

  if (error && !view) {
    return (
      <section className="page">
        <div className="empty">
          <h3>Could not open this card</h3>
          <p className="error">{error}</p>
          <button type="button" className="btn ghost" onClick={() => history.back()}>
            Go back
          </button>
        </div>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="page">
        <div className="hero skeleton-hero" aria-busy="true">
          <span className="avatar big sk" />
          <div className="sk-lines">
            <span style={{ width: '40%' }} />
            <span style={{ width: '60%' }} />
          </div>
        </div>
        <SkeletonTable rows={5} />
      </section>
    );
  }

  const rules = new Map(view.controls.merchantRules.map((r) => [r.merchant, r.type]));
  const needle = search.trim().toLowerCase();
  const all = activity ?? [];
  const rows = all.filter(
    (t) =>
      (!onlyFlagged || t.decision !== 'ALLOW' || t.alerts.length > 0) &&
      (channel === 'ALL' || t.channel === channel) &&
      (!needle || t.merchant.toLowerCase().includes(needle) || category(t.category).toLowerCase().includes(needle)),
  );
  const openCount = all.reduce((n, t) => n + t.alerts.filter((a) => a.status === 'OPEN').length, 0);
  const frozen = view.account?.frozen ?? false;

  async function review(alert: CaseAlert, status: 'CONFIRMED' | 'CLEARED', reason: string | null) {
    await api.reviewAlert(cardId, alert, status, reason);
  }

  async function reviewAll(alerts: CaseAlert[], status: 'CONFIRMED' | 'CLEARED', reason: string | null) {
    for (const a of alerts) await review(a, status, reason);
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

  async function freeze(next: boolean, reason: string | null) {
    const { frozen: now } = await api.setFrozen(cardId, next, reason);
    setView((v) => (v && v.account ? { ...v, account: { ...v.account, frozen: now } } : v));
    await loadActivity();
  }

  async function setLogin(enabled: boolean, reason: string | null) {
    const { status } = await api.setLoginEnabled(cardId, enabled, reason);
    setView((v) => (v && v.login ? { ...v, login: { ...v.login, status, failedLogins: 0 } } : v));
    setAudit(await api.fetchAudit(cardId));
  }

  function toggle(txnId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  }

  return (
    <section className="page">
      <button type="button" className="back" onClick={() => history.back()}>
        <Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} />
        Back
      </button>

      <header className={`hero${frozen ? ' is-frozen' : ''}`}>
        <span className="avatar big">{initials(view.holder.name)}</span>
        <div className="hero-text">
          <div className="hero-title">
            <h1>{view.holder.name}</h1>
            {view.account && (
              <span className={`status ${frozen ? 'frozen' : 'active'}`}>
                <Icon name={frozen ? 'snow' : 'check'} size={13} strokeWidth={2.2} />
                {frozen ? 'Frozen' : 'Active'}
              </span>
            )}
          </div>
          <p className="hero-card mono">
            <Icon name="card" size={15} />
            {cardNumber(view.cardId)}
          </p>
          <p className="muted small">
            {[view.holder.city, view.holder.state].filter(Boolean).join(', ') || 'No address'} · {view.holder.email}
            {view.holder.dob && ` · born ${view.holder.dob}`}
          </p>
          <p className="audit-note">
            <Icon name="eye" size={13} /> Opening this file was recorded in the audit log.
          </p>
        </div>
        <div className="hero-side">
          <Gauge value={view.state?.riskScore ?? 0} label="risk score" />
          {isAgent &&
            view.account &&
            (frozen ? (
              <ReasonAction
                label="Unfreeze card"
                confirm="Unfreeze card"
                title="Unfreeze this card?"
                description={<p>Payments on this card will be checked by the fraud rules again instead of declined.</p>}
                icon="unlock"
                tone="primary"
                size="normal"
                onRun={(r) => freeze(false, r)}
              />
            ) : (
              <ReasonAction
                label="Freeze card"
                confirm="Freeze card"
                title="Freeze this card?"
                description={
                  <p>
                    Every payment on <b className="mono">{cardNumber(view.cardId)}</b> will be declined until the card
                    is unfrozen. The cardholder sees this in their app.
                  </p>
                }
                icon="snow"
                tone="danger"
                size="normal"
                onRun={(r) => freeze(true, r)}
              />
            ))}
        </div>
      </header>

      {view.login && view.login.status !== 'ACTIVE' && (
        <div className="frozen-banner login-banner">
          <Icon name="logout" size={16} />
          {view.login.status === 'LOCKED'
            ? 'App sign-in is locked after 5 wrong passwords. An agent can unlock it once the caller is verified.'
            : 'App sign-in is turned off for this cardholder.'}
        </div>
      )}

      {frozen && (
        <div className="frozen-banner">
          <Icon name="snow" size={16} />
          This card is frozen. Every payment on it is declined with rule FROZEN.
        </div>
      )}

      <div className="kpis">
        <Kpi
          label="Balance"
          value={view.account ? compactVnd(view.account.balance) : '—'}
          sub={view.account ? vnd(view.account.balance) : 'No account'}
        />
        <Kpi
          label="Flagged amount"
          value={view.state ? compactVnd(view.state.amountSum) : '—'}
          sub={view.state ? vnd(view.state.amountSum) : 'No case'}
          tone="ctrl"
        />
        <Kpi
          label="Open alerts"
          value={String(activity ? openCount : (view.state?.openAlerts ?? 0))}
          sub={activity ? `in the last ${days} days` : 'on the case'}
          tone="hl"
        />
        <Kpi
          label="Last decision"
          value={view.state?.lastDecision ? '' : '—'}
          sub={view.state ? ago(view.state.updatedAt) : 'No case'}
        >
          {view.state?.lastDecision && <VerdictBadge verdict={view.state.lastDecision} />}
        </Kpi>
      </div>

      <div className="card-layout">
        <div className="card-main">
          <div className="panel">
            <div className="section-head">
              <h2>Activity</h2>
              <div className="seg" role="group" aria-label="Period">
                {RANGES.map((d) => (
                  <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
                    {d} days
                  </button>
                ))}
              </div>
            </div>
            {activity ? (
              <StackedColumns
                buckets={buckets}
                series={SERIES}
                format={compactVnd}
                axisEvery={days === 7 ? 1 : days === 30 ? 5 : 15}
                height={150}
                caption={`Amount per day by decision over the last ${days} days`}
              />
            ) : (
              <div className="chart-loading" />
            )}
          </div>

          <div className="toolbar">
            <label className="search-box">
              <Icon name="search" size={15} />
              <input placeholder="Merchant or category" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <div className="seg" role="group" aria-label="Channel">
              {(['ALL', 'CARD', 'TRANSFER'] as Channel[]).map((c) => (
                <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}>
                  {c === 'ALL' ? 'All' : c === 'CARD' ? 'Card' : 'Transfers'}
                </button>
              ))}
            </div>
            <label className="switch">
              <input
                type="checkbox"
                role="switch"
                checked={onlyFlagged}
                onChange={(e) => setOnlyFlagged(e.target.checked)}
              />
              <span className="switch-track" aria-hidden>
                <span />
              </span>
              Flagged only
            </label>
            <span className="muted small toolbar-hint">
              {rows.length} of {all.length} payments
            </span>
          </div>

          {error && <p className="error banner">{error}</p>}
          {!activity && <SkeletonTable rows={5} />}
          {activity && rows.length === 0 && (
            <div className="empty">
              <h3>Nothing in this period</h3>
              <p className="muted">Try a longer period or clear the filters.</p>
            </div>
          )}
          {rows.length > 0 && (
            <div className="table-card">
              <table className="grid activity">
                <thead>
                  <tr>
                    <th aria-label="Details" />
                    <th>Time</th>
                    <th>Merchant / recipient</th>
                    <th className="num">Amount</th>
                    <th>Decision</th>
                    <th>Rules</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const open = t.alerts.filter((a) => a.status === 'OPEN');
                    const merchantRule = rules.get(t.merchant);
                    const isOpen = expanded.has(t.txnId);
                    return (
                      <Fragment key={t.txnId}>
                        <tr
                          className={`clickable${t.decision !== 'ALLOW' ? ` flagged f-${t.decision.toLowerCase()}` : ''}`}
                          onClick={() => toggle(t.txnId)}
                        >
                          <td className="expander">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-expanded={isOpen}
                              aria-label="Show alerts"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(t.txnId);
                              }}
                            >
                              <Icon
                                name="chevron"
                                size={14}
                                style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}
                              />
                            </button>
                          </td>
                          <td className="muted nowrap" title={dateTime(t.ts)}>
                            {shortDateTime(t.ts)}
                          </td>
                          <td>
                            <span className="merchant">
                              <span
                                className={`chan c-${t.channel.toLowerCase()}`}
                                title={t.channel === 'CARD' ? 'Card payment' : 'Transfer'}
                              >
                                <Icon name={t.channel === 'CARD' ? 'card' : 'transfer'} size={14} />
                              </span>
                              <span>
                                <b>{t.merchant}</b>
                                {merchantRule && (
                                  <span className={`rule-type ${merchantRule.toLowerCase()}`}>
                                    {merchantRule === 'BLOCK' ? 'blocked' : 'allowed'}
                                  </span>
                                )}
                                <small className="muted">
                                  {t.channel === 'TRANSFER' ? (
                                    <span className="mono">
                                      {t.direction === 'IN' ? 'from ' : ''}
                                      {t.recipientAccount}
                                    </span>
                                  ) : (
                                    category(t.category)
                                  )}
                                </small>
                              </span>
                            </span>
                          </td>
                          <td className={`num strong${t.direction === 'IN' ? ' credit' : ''}`}>
                            {t.direction === 'IN' ? `+${vnd(t.amount)}` : vnd(t.amount)}
                          </td>
                          <td>
                            <span className="decision">
                              <VerdictBadge verdict={t.decision} />
                              <PostingBadge status={t.status} declinedFor={t.declinedFor} />
                            </span>
                          </td>
                          <td>
                            <div className="chips">
                              {t.alerts.length > 0
                                ? t.alerts.map((a) => (
                                    <RuleChip key={a.alertId} ruleId={a.ruleId} status={a.status} compact />
                                  ))
                                : t.firedRules.map((r) => <RuleChip key={r} ruleId={r} compact />)}
                            </div>
                          </td>
                          <td className="actions" onClick={(e) => e.stopPropagation()}>
                            {open.length > 0 && (
                              <>
                                <ReasonAction
                                  label="Fraud"
                                  confirm="Confirm fraud"
                                  title="Confirm this payment as fraud?"
                                  description={
                                    <PaymentSummary
                                      t={t}
                                      note={`${open.length} open ${open.length === 1 ? 'alert' : 'alerts'} will be marked as fraud.`}
                                    />
                                  }
                                  icon="shield"
                                  tone="danger"
                                  onRun={(r) => reviewAll(open, 'CONFIRMED', r)}
                                />
                                <ReasonAction
                                  label="Clear"
                                  confirm="Clear alerts"
                                  title="Clear these alerts?"
                                  description={
                                    <PaymentSummary
                                      t={t}
                                      note="The payment was genuine; the alerts close as cleared."
                                    />
                                  }
                                  icon="check"
                                  onRun={(r) => reviewAll(open, 'CLEARED', r)}
                                />
                              </>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="detail-row">
                            <td />
                            <td colSpan={6}>
                              <div className="detail">
                                <div className="detail-facts">
                                  <span>
                                    Score <b>{score(t.score)}</b>
                                  </span>
                                  <span>
                                    Category <b>{category(t.category)}</b>
                                  </span>
                                  <span>
                                    Currency <b>{t.currency}</b>
                                  </span>
                                  <span>
                                    Payment <b className="mono">{t.txnId}</b>
                                  </span>
                                </div>
                                {isAgent && t.channel === 'CARD' && (
                                  <div className="detail-merchant">
                                    <span className="muted small">
                                      {merchantRule === 'BLOCK'
                                        ? `${t.merchant} is blocked for this card.`
                                        : merchantRule === 'ALLOW'
                                          ? `${t.merchant} is always allowed for this card.`
                                          : `No merchant rule for ${t.merchant}.`}
                                    </span>
                                    {merchantRule !== 'BLOCK' && (
                                      <ReasonAction
                                        label="Block merchant"
                                        confirm="Block merchant"
                                        title={`Block ${t.merchant}?`}
                                        description={
                                          <p>Every future payment from this card to {t.merchant} will be declined.</p>
                                        }
                                        icon="ban"
                                        tone="danger"
                                        onRun={(r) => rule(t.merchant, 'BLOCK', r)}
                                      />
                                    )}
                                    {merchantRule !== 'ALLOW' && t.decision !== 'ALLOW' && (
                                      <ReasonAction
                                        label="Always allow"
                                        confirm="Allow merchant"
                                        title={`Always allow ${t.merchant}?`}
                                        description={
                                          <p>Payments from this card to {t.merchant} skip the merchant checks.</p>
                                        }
                                        icon="check"
                                        onRun={(r) => rule(t.merchant, 'ALLOW', r)}
                                      />
                                    )}
                                  </div>
                                )}
                                {t.alerts.length === 0 ? (
                                  t.firedRules.length > 0 && (
                                    <p className="muted small">
                                      The rules fired but no alert was raised for this payment.
                                    </p>
                                  )
                                ) : (
                                  <ul className="alert-list">
                                    {t.alerts.map((a) => (
                                      <li key={a.alertId} className={`s-${a.status.toLowerCase()}`}>
                                        <RuleChip ruleId={a.ruleId} />
                                        <span className="muted small">
                                          {ruleTitle(a.ruleId)} · score {score(a.score)}
                                        </span>
                                        <span className={`review r-${a.status.toLowerCase()}`}>
                                          {a.status === 'OPEN'
                                            ? 'Open'
                                            : a.status === 'CONFIRMED'
                                              ? 'Confirmed fraud'
                                              : 'Cleared'}
                                        </span>
                                        {a.status === 'OPEN' && (
                                          <span className="alert-actions">
                                            <ReasonAction
                                              label="Fraud"
                                              confirm="Confirm fraud"
                                              title={`Confirm ${a.ruleId} as fraud?`}
                                              icon="shield"
                                              tone="danger"
                                              onRun={(r) => reviewAll([a], 'CONFIRMED', r)}
                                            />
                                            <ReasonAction
                                              label="Clear"
                                              confirm="Clear alert"
                                              title={`Clear ${a.ruleId}?`}
                                              icon="check"
                                              onRun={(r) => reviewAll([a], 'CLEARED', r)}
                                            />
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="card-aside">
          <div className="panel">
            <h2>Account</h2>
            {view.account ? (
              <dl className="facts">
                <dt>Number</dt>
                <dd className="mono">{accountNumber(view.account.accountNumber)}</dd>
                <dt>Balance</dt>
                <dd>{vnd(view.account.balance)}</dd>
                <dt>Case priority</dt>
                <dd>{view.state ? Math.round(view.state.priority).toLocaleString('en-US') : '—'}</dd>
                <dt>App sign-in</dt>
                <dd>
                  {view.login ? (
                    <span className={`login-status l-${view.login.status.toLowerCase()}`}>
                      {LOGIN_LABEL[view.login.status]}
                    </span>
                  ) : (
                    'None'
                  )}
                </dd>
                {view.login && view.login.status === 'ACTIVE' && view.login.failedLogins > 0 && (
                  <>
                    <dt>Wrong passwords</dt>
                    <dd>{view.login.failedLogins} of 5</dd>
                  </>
                )}
                <dt>Last sign-in</dt>
                <dd>{view.login?.lastLoginAt ? ago(view.login.lastLoginAt) : 'Never'}</dd>
                <dt>Budget</dt>
                <dd>
                  {view.controls.budget
                    ? `${vnd(view.controls.budget.limit)} per ${view.controls.budget.period.toLowerCase()}`
                    : 'None set'}
                </dd>
              </dl>
            ) : (
              <p className="muted">No account.</p>
            )}
            {isAgent &&
              view.login &&
              (view.login.status === 'ACTIVE' ? (
                <ReasonAction
                  label="Turn off app sign-in"
                  confirm="Turn off sign-in"
                  title="Turn off app sign-in?"
                  description={
                    <p>
                      The cardholder is signed out of the app and can't sign in again until an agent restores it. Card
                      payments are not affected; freeze the card for that.
                    </p>
                  }
                  icon="logout"
                  tone="danger"
                  onRun={(r) => setLogin(false, r)}
                />
              ) : (
                <ReasonAction
                  label={view.login.status === 'LOCKED' ? 'Unlock app sign-in' : 'Restore app sign-in'}
                  confirm={view.login.status === 'LOCKED' ? 'Unlock sign-in' : 'Restore sign-in'}
                  title={view.login.status === 'LOCKED' ? 'Unlock app sign-in?' : 'Restore app sign-in?'}
                  description={
                    <p>
                      Check you are speaking to the cardholder first. They can sign in with their current password, and
                      the wrong-password count starts again from zero.
                    </p>
                  }
                  icon="unlock"
                  tone="primary"
                  onRun={(r) => setLogin(true, r)}
                />
              ))}
          </div>

          <div className="panel">
            <h2>Merchant rules</h2>
            {view.controls.merchantRules.length === 0 ? (
              <p className="muted small">No merchant is blocked or allowed for this card.</p>
            ) : (
              <ul className="rules-list">
                {view.controls.merchantRules.map((r) => (
                  <li key={r.merchant}>
                    <span className={`rule-icon ${r.type.toLowerCase()}`}>
                      <Icon name={r.type === 'BLOCK' ? 'ban' : 'check'} size={14} />
                    </span>
                    <span className="grow">
                      <b>{r.merchant}</b>
                      <small className="muted">
                        {r.type === 'BLOCK' ? 'Blocked' : 'Allowed'} · {ago(r.createdAt)}
                      </small>
                    </span>
                    {isAgent && (
                      <ReasonAction
                        label="Remove"
                        confirm="Remove rule"
                        title={`Remove the rule for ${r.merchant}?`}
                        icon="x"
                        onRun={(reason) => release(r.merchant, reason)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isAgent && <AddRule onAdd={rule} />}
          </div>

          <div className="panel">
            <h2>Audit trail</h2>
            {audit.length === 0 ? (
              <p className="muted small">Nothing yet.</p>
            ) : (
              <ol className="timeline">
                {audit.map((e) => (
                  <li key={e.auditId} className={`a-${e.action.toLowerCase()}`}>
                    <span className="tl-icon">
                      <Icon name={AUDIT_ICON[e.action] ?? 'clock'} size={13} />
                    </span>
                    <div>
                      <p>
                        <b>{e.staffName}</b>{' '}
                        {(ACTION_LABEL[e.action] ?? e.action).replace(/^\w/, (c) => c.toLowerCase())}
                        {e.payload.merchant && <> · {e.payload.merchant}</>}
                      </p>
                      {e.payload.reason && <blockquote>{e.payload.reason}</blockquote>}
                      <small className="muted">
                        {dateTime(e.at)} · {e.staffRole === 'ANALYST' ? 'analyst' : 'agent'}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function PaymentSummary({ t, note }: { t: Activity; note: string }) {
  return (
    <div className="pay-summary">
      <div>
        <b>{t.merchant}</b>
        <span className="muted small">{dateTime(t.ts)}</span>
      </div>
      <span className="amount">{vnd(t.amount)}</span>
      <p className="muted small">{note}</p>
    </div>
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
      <div className="seg full" role="group" aria-label="Rule type">
        {(['BLOCK', 'ALLOW'] as RuleType[]).map((r) => (
          <button key={r} type="button" aria-pressed={type === r} onClick={() => setType(r)}>
            <Icon name={r === 'BLOCK' ? 'ban' : 'check'} size={13} />
            {r === 'BLOCK' ? 'Block' : 'Allow'}
          </button>
        ))}
      </div>
      <input
        placeholder="Merchant name"
        value={merchant}
        maxLength={120}
        onChange={(e) => setMerchant(e.target.value)}
      />
      <input
        placeholder="Reason (audit log)"
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
      />
      <button className="btn primary small" disabled={busy || !merchant.trim()}>
        <Icon name="plus" size={14} />
        {busy ? 'Saving…' : 'Add rule'}
      </button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}
