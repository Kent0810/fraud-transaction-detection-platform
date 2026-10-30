import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { Icon, type IconName } from './Icons';

/**
 * A button that opens a confirmation dialog with an optional reason; the reason goes to the audit log.
 */
export function ReasonAction({
  label,
  confirm,
  title,
  description,
  icon,
  tone = 'plain',
  size = 'small',
  onRun,
}: {
  label: string;
  confirm: string;
  title?: string;
  description?: ReactNode;
  icon?: IconName;
  tone?: 'plain' | 'danger' | 'primary';
  size?: 'small' | 'normal';
  onRun: (reason: string | null) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

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

  const buttonTone = tone === 'danger' ? 'danger' : tone === 'primary' ? 'primary' : 'ghost';

  return (
    <>
      <button
        type="button"
        className={`btn ${size === 'small' ? 'small' : ''} ${tone === 'danger' ? 'ghost danger' : buttonTone}`}
        onClick={(e) => {
          e.stopPropagation();
          setError(null);
          setOpen(true);
        }}
      >
        {icon && <Icon name={icon} size={size === 'small' ? 14 : 16} />}
        {label}
      </button>
      <dialog
        ref={dialog}
        className="modal"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === dialog.current && !busy) setOpen(false);
        }}
      >
        <form method="dialog" onSubmit={submit}>
          <header className={`modal-head t-${tone}`}>
            {icon && (
              <span className="modal-icon">
                <Icon name={icon} size={20} />
              </span>
            )}
            <h2>{title ?? confirm}</h2>
          </header>
          {description && <div className="modal-body">{description}</div>}
          <label className="field">
            <span>
              Reason <span className="muted">· optional, saved to the audit log</span>
            </span>
            <textarea
              autoFocus
              rows={3}
              value={reason}
              maxLength={500}
              placeholder="e.g. Cardholder confirmed by phone they did not make this payment"
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
              }}
            />
            <span className="field-foot muted">{reason.length}/500</span>
          </label>
          {error && <p className="error">{error}</p>}
          <footer className="modal-foot">
            <button type="button" className="btn ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className={`btn ${tone === 'plain' ? 'primary' : buttonTone}`} disabled={busy}>
              {busy ? <span className="spinner" aria-hidden /> : icon && <Icon name={icon} size={16} />}
              {busy ? 'Saving…' : confirm}
            </button>
          </footer>
        </form>
      </dialog>
    </>
  );
}
