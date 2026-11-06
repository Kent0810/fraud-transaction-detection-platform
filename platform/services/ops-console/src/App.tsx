import { type ReactNode, useCallback, useState } from 'react';

import { AlertPrefs } from './components/AlertPrefs';
import { CommandPalette, ShortcutHelp } from './components/CommandPalette';
import { Icon, type IconName } from './components/Icons';
import { Toasts } from './components/Toasts';
import { useAuth } from './data/auth';
import { initials } from './data/format';
import { useHotkeys } from './data/hotkeys';
import { LiveAlertsProvider, useLive } from './data/live';
import { go, href, type Route, useRoute } from './data/router';
import type { StaffRole } from './data/types';
import { Card } from './pages/Card';
import { Find } from './pages/Find';
import { Followups } from './pages/Followups';
import { Login } from './pages/Login';
import { Queue } from './pages/Queue';
import { Terminal } from './pages/Terminal';

const HOME: Record<StaffRole, Route> = {
  ANALYST: { page: 'queue' },
  AGENT: { page: 'find' },
};

const ROLE_LABEL: Record<StaffRole, string> = {
  ANALYST: 'Fraud analyst',
  AGENT: 'Service agent',
};

export function App() {
  const { session } = useAuth();
  if (!session) return <Login />;
  return (
    <LiveAlertsProvider token={session.token}>
      <Shell role={session.role} />
    </LiveAlertsProvider>
  );
}

function Shell({ role }: { role: StaffRole }) {
  const { session, signOut } = useAuth();
  const { unseen, connection } = useLive();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const route = useRoute() ?? HOME[role];
  const page = route;

  const closePalette = useCallback(() => setPalette(false), []);

  useHotkeys({
    'mod+k': () => setPalette(true),
    '/': () => setPalette(true),
    '?': () => setHelp(true),
    'g q': () => go({ page: 'queue' }),
    'g f': () => go({ page: 'find' }),
    'g u': () => go({ page: 'followups' }),
    'g m': () => go({ page: 'terminal' }),
  });

  const nav = (to: Route, label: string, icon: IconName, keys: string, extra?: ReactNode) => (
    <a href={href(to)} aria-current={page.page === to.page ? 'page' : undefined}>
      <Icon name={icon} size={18} />
      <span className="nav-label">{label}</span>
      {extra}
      <span className="nav-keys">{keys}</span>
    </a>
  );

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="mark" aria-hidden>
            <Icon name="radar" size={18} />
          </span>
          <span>
            <b>HCMMB</b>
            <small>Operator Console</small>
          </span>
        </div>

        <button type="button" className="search-trigger" onClick={() => setPalette(true)}>
          <Icon name="search" size={16} />
          <span>Search a card…</span>
          <kbd>⌘K</kbd>
        </button>

        <nav className="side-nav">
          {nav(
            { page: 'queue' },
            'Triage queue',
            'queue',
            'G Q',
            role === 'ANALYST' && unseen > 0 && page.page !== 'queue' && (
              <span className="count">{unseen > 99 ? '99+' : unseen}</span>
            ),
          )}
          {nav({ page: 'followups' }, 'Fraud follow-ups', 'shield', 'G U')}
          {nav({ page: 'find' }, 'Find a card', 'search', 'G F')}
        </nav>

        {role === 'ANALYST' && (
          <div className={`pulse-card c-${connection}`}>
            <div className="pulse-head">
              Detector feed
              <span className="pulse-status">
                <span className={`dot c-${connection}`} />
                {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
              </span>
            </div>
            <AlertPrefs />
          </div>
        )}

        <div className="side-foot">
          <div className="me">
            <span className={`avatar r-${role.toLowerCase()}`}>{initials(session?.name ?? '')}</span>
            <span className="me-text">
              <b>{session?.name}</b>
              <small>{ROLE_LABEL[role]}</small>
            </span>
          </div>
          <div className="side-tools">
            <button type="button" className="icon-btn" onClick={() => setHelp(true)} title="Keyboard shortcuts (?)">
              <Icon name="keyboard" size={17} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => go({ page: 'terminal' })}
              title="Merchant QR (G M)"
            >
              <Icon name="qr" size={17} />
            </button>
            <button type="button" className="icon-btn" onClick={() => void signOut()} title="Sign out">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="wrap">
        {page.page === 'queue' && <Queue />}
        {page.page === 'find' && <Find />}
        {page.page === 'followups' && <Followups role={role} />}
        {page.page === 'terminal' && <Terminal />}
        {page.page === 'card' && <Card key={page.cardId} cardId={page.cardId} />}
      </main>

      <CommandPalette open={palette} onClose={closePalette} role={role} />
      <ShortcutHelp open={help} onClose={() => setHelp(false)} />
      {role === 'ANALYST' && <Toasts />}
    </div>
  );
}
