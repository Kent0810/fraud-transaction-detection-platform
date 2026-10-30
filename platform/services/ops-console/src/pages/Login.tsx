import { type FormEvent, useState } from 'react';

import { Icon } from '../components/Icons';
import { useAuth } from '../data/auth';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-side">
        <form onSubmit={submit} className="login-card">
          <div className="login-brand">
            <span className="mark">
              <Icon name="radar" size={16} />
            </span>
            <b>HCMMB fraud operations</b>
          </div>
          <div>
            <h1>Operations console</h1>
            <p className="muted">
              For fraud analysts and customer service agents. Everything you open or change is written to the audit log.
            </p>
          </div>
          <label className="field">
            <span>Work email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="name@hcmmb.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Password</span>
            <span className="input-with">
              <input
                type={reveal ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                aria-pressed={reveal}
              >
                <Icon name="eye" size={16} />
              </button>
            </span>
          </label>
          {error && (
            <p className="error banner" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary big" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden /> : <Icon name="arrow" size={16} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted small">Sessions end after 10 hours or when you close this tab.</p>
        </form>
      </section>
    </main>
  );
}
