import type { ReactNode } from 'react';

import { Toasts } from './components/Toasts';
import { useAuth } from './data/auth';
import { LiveAlertsProvider, useLive } from './data/live';
import { href, type Route, useRoute } from './data/router';
import type { StaffRole } from './data/types';
import { Alerts } from './pages/Alerts';
import { Card } from './pages/Card';
import { Find } from './pages/Find';
import { Login } from './pages/Login';
import { Queue } from './pages/Queue';

const HOME: Record<StaffRole, Route> = {
  ANALYST: { page: 'queue' },
  AGENT: { page: 'find' },
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
  const route = useRoute() ?? HOME[role];
  const page = route.page === 'queue' && role !== 'ANALYST' ? HOME[role] : route;

  const tab = (to: Route, label: string, extra?: ReactNode) => (
    <a href={href(to)} aria-current={page.page === to.page ? 'page' : undefined}>
      {label}
      {extra}
    </a>
  );

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden />
          Operations console
        </div>
        <nav>
          {role === 'ANALYST' && tab({ page: 'queue' }, 'Triage queue')}
          {tab({ page: 'find' }, 'Find a card')}
          {tab(
            { page: 'alerts' },
            'Live alerts',
            <>
              <span className={`dot c-${connection}`} title={connection} />
              {unseen > 0 && page.page !== 'alerts' && <span className="count">{unseen > 99 ? '99+' : unseen}</span>}
            </>,
          )}
        </nav>
        <div className="who">
          <span>
            {session?.name} <span className="muted">· {role === 'ANALYST' ? 'Fraud analyst' : 'Service agent'}</span>
          </span>
          <button type="button" className="btn small ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="wrap">
        {page.page === 'queue' && <Queue />}
        {page.page === 'find' && <Find />}
        {page.page === 'alerts' && <Alerts />}
        {page.page === 'card' && <Card key={page.cardId} cardId={page.cardId} />}
      </main>
      <Toasts />
    </>
  );
}
