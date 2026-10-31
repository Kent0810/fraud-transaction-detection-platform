import QRCode from 'qrcode';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Icon } from '../components/Icons';
import { type MerchantQr, type MerchantRef, merchantQr, searchMerchants } from '../data/api';
import { category, vnd } from '../data/format';
import { useNow } from '../data/now';

// A merchant's till for demos: show the QR code a cardholder scans in the app to pay. Static codes let the payer type
// the amount; a code with an amount is signed by the bank and expires after 10 minutes.
export function Terminal() {
  const [q, setQ] = useState('');
  const [merchants, setMerchants] = useState<MerchantRef[]>([]);
  const [picked, setPicked] = useState<MerchantRef | null>(null);
  const [amountText, setAmountText] = useState('');
  const [code, setCode] = useState<MerchantQr | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMerchants(q).then(setMerchants, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const amount = Number(amountText.replace(/\D/g, '')) || null;

  async function show(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setCode(await merchantQr(picked.merchantId, amount));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code.payload);
    setCopied(true);
  }

  return (
    <section className="page terminal-page">
      <header className="page-head">
        <h1>Merchant QR</h1>
        <p className="muted">
          A merchant's till. Pick a merchant, optionally fix the amount, and let the cardholder scan the code in the
          app.
        </p>
      </header>

      <div className="terminal">
        <form className="panel" onSubmit={show}>
          <label className="field">
            Merchant
            <input
              placeholder="Search by name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search merchants"
            />
          </label>
          <ul className="person-list terminal-list">
            {merchants.map((m) => (
              <li key={m.merchantId}>
                <a
                  href="#/terminal"
                  aria-current={picked?.merchantId === m.merchantId ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setPicked(m);
                    setCode(null);
                  }}
                >
                  <span className="person-text">
                    <b>{m.name}</b>
                    <small>{category(m.category)}</small>
                  </span>
                  {picked?.merchantId === m.merchantId && <Icon name="check" size={16} />}
                </a>
              </li>
            ))}
          </ul>
          <label className="field">
            Amount (VND), empty for a static code
            <input
              inputMode="numeric"
              placeholder="e.g. 150000"
              value={amountText}
              onChange={(e) => {
                setAmountText(e.target.value.replace(/[^\d]/g, ''));
                setCode(null);
              }}
            />
          </label>
          <button className="btn primary" disabled={!picked || busy}>
            {busy ? <span className="spinner" aria-hidden /> : <Icon name="qr" size={16} />}
            {amount ? `Show code for ${vnd(amount)}` : 'Show static code'}
          </button>
          {error && (
            <p className="error banner" role="alert">
              {error}
            </p>
          )}
        </form>

        <div className="panel terminal-code">
          {code ? (
            <>
              <QrSvg value={code.payload} />
              <b>{code.merchant.name}</b>
              <span className="terminal-amount">{code.amount ? vnd(code.amount) : 'Customer enters the amount'}</span>
              {code.expiresAt && <Expiry at={code.expiresAt} />}
              <button type="button" className="btn" onClick={() => void copy()}>
                <Icon name={copied ? 'check' : 'plus'} size={15} />
                {copied ? 'Copied' : 'Copy code text'}
              </button>
              <small className="muted mono terminal-payload">{code.payload}</small>
            </>
          ) : (
            <p className="muted small">The code shows here.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Expiry({ at }: { at: string }) {
  const now = useNow(1000);
  const left = Math.max(0, Math.round((new Date(at).getTime() - now) / 1000));
  return (
    <span className={left === 0 ? 'error' : 'muted small'}>
      {left === 0
        ? 'Expired: show a new code'
        : `Valid for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
    </span>
  );
}

// Dark on white always, so a phone can read it off any screen.
function QrSvg({ value }: { value: string }) {
  const { path, view } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { path: d, view: modules.size + 8 };
  }, [value]);
  return (
    <svg className="terminal-qr" viewBox={`-4 -4 ${view} ${view}`} role="img" aria-label="Payment QR code">
      <rect x={-4} y={-4} width={view} height={view} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}
