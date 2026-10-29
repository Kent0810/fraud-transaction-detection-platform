import { type FormEvent, useState } from 'react';

import { findCard } from '../data/api';
import { go } from '../data/router';

export function Find() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { cardId } = await findCard(q.replace(/\s/g, ''));
      go({ page: 'card', cardId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="narrow">
      <header className="page-head">
        <div>
          <h1>Find a card</h1>
          <p className="muted">The card number or account number the caller reads out. Opening the card is audited.</p>
        </div>
      </header>
      <form className="find" onSubmit={submit}>
        <input
          autoFocus
          inputMode="numeric"
          placeholder="e.g. 180048185037117 or 1903 0000 0001"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" disabled={busy || !q.trim()}>
          {busy ? 'Looking…' : 'Open card'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
