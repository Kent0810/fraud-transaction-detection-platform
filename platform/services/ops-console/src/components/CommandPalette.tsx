import { useEffect, useMemo, useRef, useState } from 'react';

import { findCard } from '../data/api';
import { ago, cardNumber } from '../data/format';
import { useLive } from '../data/live';
import { recentCards } from '../data/recent';
import { go, type Route } from '../data/router';
import type { StaffRole } from '../data/types';
import { Icon, type IconName } from './Icons';

type Item = {
  id: string;
  icon: IconName;
  label: string;
  hint?: string;
  group: string;
  run: () => void | Promise<void>;
};

/** Cmd/Ctrl+K: jump to a page, a recent card, a card from the live feed, or look up a card or account number. */
export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: StaffRole }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { alerts } = useLive();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      setError(null);
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const to = (route: Route) => () => {
      go(route);
      onClose();
    };
    const digits = q.replace(/\s/g, '');
    const list: Item[] = [];
    if (/^\d{6,}$/.test(digits)) {
      list.push({
        id: 'lookup',
        icon: 'search',
        label: `Open card or account ${cardNumber(digits)}`,
        hint: 'Enter',
        group: 'Look up',
        run: async () => {
          setBusy(true);
          setError(null);
          try {
            const { cardId } = await findCard(digits);
            go({ page: 'card', cardId });
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        },
      });
    }
    const pages: Item[] = [
      ...(role === 'ANALYST'
        ? [
            {
              id: 'p-queue',
              icon: 'queue' as const,
              label: 'Triage queue',
              hint: 'G Q',
              group: 'Go to',
              run: to({ page: 'queue' }),
            },
          ]
        : []),
      { id: 'p-find', icon: 'search', label: 'Find a card', hint: 'G F', group: 'Go to', run: to({ page: 'find' }) },
      { id: 'p-alerts', icon: 'bell', label: 'Live alerts', hint: 'G A', group: 'Go to', run: to({ page: 'alerts' }) },
    ];
    const recent: Item[] = recentCards().map((c) => ({
      id: `r-${c.cardId}`,
      icon: 'clock',
      label: c.name,
      hint: `${cardNumber(c.cardId)} · ${ago(c.openedAt)}`,
      group: 'Recently opened',
      run: to({ page: 'card', cardId: c.cardId }),
    }));
    const seen = new Set<string>();
    const live: Item[] = alerts
      .filter((a) => !seen.has(a.cardId) && seen.add(a.cardId))
      .slice(0, 5)
      .map((a) => ({
        id: `l-${a.cardId}`,
        icon: a.decision === 'DECLINE' ? 'ban' : 'shield',
        label: `${a.merchant}`,
        hint: `${cardNumber(a.cardId)} · ${a.firedRules.join(', ')}`,
        group: 'From the live feed',
        run: to({ page: 'card', cardId: a.cardId }),
      }));
    const needle = q.trim().toLowerCase();
    const match = (i: Item) =>
      !needle || i.label.toLowerCase().includes(needle) || (i.hint ?? '').replace(/\s/g, '').includes(digits);
    return [...list, ...[...pages, ...recent, ...live].filter(match)];
  }, [q, alerts, role, onClose]);

  const safeCursor = Math.min(cursor, Math.max(items.length - 1, 0));
  let lastGroup = '';

  return (
    <dialog
      ref={dialog}
      className="palette"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="palette-input">
        <Icon name="search" size={18} />
        <input
          autoFocus
          value={q}
          placeholder="Card number, account number, or a page…"
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && items[safeCursor] && !busy) {
              e.preventDefault();
              void items[safeCursor].run();
            }
          }}
        />
        {busy && <span className="spinner" aria-hidden />}
        <kbd>Esc</kbd>
      </div>
      {error && <p className="palette-error">{error}</p>}
      <ul className="palette-list" role="listbox">
        {items.length === 0 && <li className="palette-empty">Nothing matches. Type a card or account number.</li>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.id} role="presentation">
              {header && <div className="palette-group">{header}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === safeCursor}
                onMouseMove={() => setCursor(i)}
                onClick={() => void item.run()}
              >
                <Icon name={item.icon} size={16} />
                <span className="palette-label">{item.label}</span>
                {item.hint && <span className="palette-hint">{item.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <footer className="palette-foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> move
        </span>
        <span>
          <kbd>Enter</kbd> open
        </span>
        <span>Every card you open is audited.</span>
      </footer>
    </dialog>
  );
}

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Search cards and pages'],
  [['/'], 'Search cards and pages'],
  [['G', 'Q'], 'Triage queue (analysts)'],
  [['G', 'F'], 'Find a card'],
  [['G', 'A'], 'Live alerts'],
  [['J', 'K'], 'Move down / up a list'],
  [['Enter'], 'Open the selected row'],
  [['?'], 'This help'],
];

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <header className="modal-head">
        <span className="modal-icon">
          <Icon name="keyboard" size={20} />
        </span>
        <h2>Keyboard shortcuts</h2>
      </header>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={what + keys.join()}>
            <dt>
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <footer className="modal-foot">
        <button type="button" className="btn primary" onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>
  );
}
