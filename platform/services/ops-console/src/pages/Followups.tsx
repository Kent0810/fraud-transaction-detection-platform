import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { Icon } from '../components/Icons';
import { ReasonAction } from '../components/Reason';
import * as api from '../data/api';
import { ago, cardNumber, vnd } from '../data/format';
import { href } from '../data/router';
import type { Followup, FollowupStatus, FraudMark, StaffRole } from '../data/types';

const REFRESH_MS = 5_000;

const OUTCOME: Record<FollowupStatus, string> = {
  PENDING: 'Waiting for the call',
  GENUINE: 'Cardholder made it: fraud finding discarded',
  FRAUD: 'Cardholder denied it: card frozen, recipient marked',
};

/**
 * Transactions analysts confirmed as fraud. Agents call the cardholder and record the answer; analysts see the answer
 * come back, and are the only ones who can remove a fraud mark.
 */
export function Followups({ role }: { role: StaffRole }) {
  const [followups, setFollowups] = useState<Followup[] | null>(null);
  const [marks, setMarks] = useState<FraudMark[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, m] = await Promise.all([api.fetchFollowups(), api.fetchFraudMarks()]);
      setFollowups(f);
      setMarks(m);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function resolve(f: Followup, outcome: 'GENUINE' | 'FRAUD', reason: string | null) {
    await api.resolveFollowup(f, outcome, reason);
    await load();
  }

  async function unmark(m: FraudMark, reason: string | null) {
    await api.removeFraudMark(m.recipientId, reason);
    await load();
  }

  const pending = (followups ?? []).filter((f) => f.status === 'PENDING');
  const closed = (followups ?? []).filter((f) => f.status !== 'PENDING');

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Fraud follow-ups</h1>
          <p className="muted">
            {role === 'AGENT'
              ? 'An analyst confirmed these as fraud. Call the cardholder, then record what they said.'
              : 'Alerts you confirmed as fraud, and what the cardholder told the agent.'}
          </p>
        </div>
      </header>

      {error && <p className="error banner">{error}</p>}

      <div className="panel">
        <h2>Calls to make ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted small">{followups ? 'Nothing is waiting.' : 'Loading…'}</p>
        ) : (
          <FollowupTable
            rows={pending}
            action={(f) =>
              role === 'AGENT' && (
                <>
                  <ReasonAction
                    label="Not fraud"
                    confirm="Discard fraud finding"
                    title="The cardholder made this payment?"
                    description={
                      <p>
                        The analyst's fraud finding is discarded and the alerts close as cleared. The analyst sees the
                        outcome here.
                      </p>
                    }
                    icon="check"
                    onRun={(r) => resolve(f, 'GENUINE', r)}
                  />
                  <ReasonAction
                    label="Confirm fraud"
                    confirm="Confirm fraud"
                    title="The cardholder did not make this payment?"
                    description={
                      <p>
                        This card is frozen, and {f.recipientName} is marked as fraud for the whole bank: anyone who
                        later pays them is flagged for an analyst.
                      </p>
                    }
                    icon="shield"
                    tone="danger"
                    onRun={(r) => resolve(f, 'FRAUD', r)}
                  />
                </>
              )
            }
          />
        )}
      </div>

      <div className="panel">
        <h2>Call results</h2>
        {closed.length === 0 ? <p className="muted small">No calls recorded yet.</p> : <FollowupTable rows={closed} />}
      </div>

      <div className="panel">
        <h2>Fraud-flagged recipients, all cards ({marks.length})</h2>
        {marks.length === 0 ? (
          <p className="muted small">No recipient is marked.</p>
        ) : (
          <ul className="rules-list">
            {marks.map((m) => (
              <li key={m.recipientId}>
                <span className="rule-icon block">
                  <Icon name="shield" size={14} />
                </span>
                <span className="grow">
                  <b>{m.recipientName}</b>
                  <small className="muted">
                    <span className="mono">{m.recipientId}</span> · marked by {m.markedBy} · {ago(m.markedAt)}
                  </small>
                </span>
                {role === 'ANALYST' && (
                  <ReasonAction
                    label="Remove"
                    confirm="Remove fraud mark"
                    title={`Remove the fraud mark on ${m.recipientName}?`}
                    description={<p>New payments to them stop being flagged. Past alerts stay as they are.</p>}
                    icon="x"
                    onRun={(r) => unmark(m, r)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FollowupTable({ rows, action }: { rows: Followup[]; action?: (f: Followup) => ReactNode }) {
  return (
    <div className="table-card">
      <table className="grid">
        <thead>
          <tr>
            <th>Cardholder</th>
            <th>Paid to</th>
            <th className="num">Amount</th>
            <th>Confirmed by</th>
            <th>{action ? 'Call' : 'Outcome'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={`${f.cardId}:${f.txnId}`}>
              <td>
                <a href={href({ page: 'card', cardId: f.cardId })}>
                  <b>{f.holderName}</b>
                </a>
                <small className="muted">
                  {' '}
                  <span className="mono">{cardNumber(f.cardId)}</span> · {f.holderEmail}
                </small>
              </td>
              <td>{f.recipientName}</td>
              <td className="num strong">{vnd(f.amount)}</td>
              <td className="muted">
                {f.confirmedBy} · {ago(f.confirmedAt)}
              </td>
              <td className="actions">
                {action ? (
                  action(f)
                ) : (
                  <>
                    {OUTCOME[f.status]}
                    {f.resolvedBy && f.resolvedAt && (
                      <small className="muted">
                        {' '}
                        · {f.resolvedBy} · {ago(f.resolvedAt)}
                        {f.note ? ` · ${f.note}` : ''}
                      </small>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
