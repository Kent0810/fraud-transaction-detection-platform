import { type FormEvent, useState } from 'react';

/** An action that asks for an optional reason before it runs; the reason goes to the audit log. */
export function ReasonAction({
  label,
  confirm,
  tone = 'plain',
  onRun,
}: {
  label: string;
  confirm: string;
  tone?: 'plain' | 'danger';
  onRun: (reason: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onRun(reason.trim() || null);
      setOpen(false);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`btn small ${tone === 'danger' ? 'danger' : 'ghost'}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <form className="reason" onSubmit={submit}>
      <input
        autoFocus
        placeholder="Reason (optional, goes to the audit log)"
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
      />
      <button type="submit" className={`btn small ${tone === 'danger' ? 'danger' : ''}`} disabled={busy}>
        {busy ? 'Saving…' : confirm}
      </button>
      <button type="button" className="btn small ghost" onClick={() => setOpen(false)} disabled={busy}>
        Cancel
      </button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}
