import { type FormEvent, useEffect, useState } from 'react';

import { Icon } from '../components/Icons';
import { fetchRecentCards, findCard, type RecentCard } from '../data/api';
import { ago, cardNumber, initials } from '../data/format';
import { useLive } from '../data/live';
import { go, href } from '../data/router';

export function Find() {
  const { alerts } = useLive();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentCard[] | null>(null);

  useEffect(() => {
    fetchRecentCards().then(setRecent, () => setRecent([]));
  }, []);

  const digits = q.replace(/\D/g, '');
  const kind = digits.length === 0 ? null : digits.length <= 12 ? 'account' : 'card';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { cardId } = await findCard(digits);
      go({ page: 'card', cardId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const seen = new Set<string>();
  const flagged = alerts.filter((a) => !seen.has(a.cardId) && seen.add(a.cardId)).slice(0, 6);

  return (
    <section className="page find-page">
      <div className="find-hero">
        <h1>Find a card</h1>
        <p className="muted">
          Type the card number or account number the caller reads out. Opening a card is recorded in the audit log.
        </p>

        <form className={`find${error ? ' bad' : ''}`} onSubmit={submit}>
          <Icon name="search" size={20} />
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Card or account number"
            placeholder="Card or account number"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setError(null);
            }}
          />
          {kind && <span className="find-kind">{kind === 'card' ? 'Card number' : 'Account number'}</span>}
          <button className="btn primary" disabled={busy || !digits}>
            {busy ? <span className="spinner" aria-hidden /> : <Icon name="arrow" size={16} />}
            {busy ? 'Looking…' : 'Open'}
          </button>
        </form>
        {digits && <p className="find-preview mono">{cardNumber(digits)}</p>}
        {error && (
          <p className="error banner" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="find-lists">
        <div className="panel">
          <h2>
            <Icon name="clock" size={15} /> Recently opened
          </h2>
          {recent === null ? (
            <p className="muted small">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="muted small">Cards you open show up here, from the audit log.</p>
          ) : (
            <ul className="person-list">
              {recent.map((c) => (
                <li key={c.cardId}>
                  <a href={href({ page: 'card', cardId: c.cardId })}>
                    <span className="avatar">{initials(c.name)}</span>
                    <span className="person-text">
                      <b>{c.name}</b>
                      <small className="mono">{cardNumber(c.cardId)}</small>
                    </span>
                    <span className="muted small">{ago(c.openedAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h2>
            <Icon name="bell" size={15} /> Just flagged
          </h2>
          {flagged.length === 0 ? (
            <p className="muted small">Cards with a payment stepped up or declined since you signed in.</p>
          ) : (
            <ul className="person-list">
              {flagged.map((a) => (
                <li key={a.cardId}>
                  <a href={href({ page: 'card', cardId: a.cardId })}>
                    <span className={`avatar t-${a.decision.toLowerCase()}`}>
                      <Icon name={a.decision === 'DECLINE' ? 'ban' : 'shield'} size={15} />
                    </span>
                    <span className="person-text">
                      <b>{a.merchant}</b>
                      <small className="mono">{cardNumber(a.cardId)}</small>
                    </span>
                    <span className="muted small">{ago(new Date(a.receivedAt).toISOString())}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
