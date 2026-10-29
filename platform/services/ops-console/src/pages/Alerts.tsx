import { useEffect } from 'react';

import { RuleChip, VerdictBadge } from '../components/Badges';
import { category, dateTime, score, vnd } from '../data/format';
import { useLive } from '../data/live';
import { go } from '../data/router';

export function Alerts() {
  const { alerts, connection, prefs, setPrefs, markSeen } = useLive();

  useEffect(markSeen, [alerts, markSeen]);

  async function toggleDesktop(on: boolean) {
    if (on && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    setPrefs({ ...prefs, desktop: on && 'Notification' in window && Notification.permission === 'granted' });
  }

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Live alerts</h1>
          <p className="muted">
            Every payment the fraud detector steps up or declines, the moment it is decided. Kept for this session only.
          </p>
        </div>
        <span className={`conn c-${connection}`}>
          {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </span>
      </header>

      <div className="prefs">
        <label>
          <input
            type="checkbox"
            checked={prefs.declinesOnly}
            onChange={(e) => setPrefs({ ...prefs, declinesOnly: e.target.checked })}
          />
          Declines only
        </label>
        <label>
          <input
            type="checkbox"
            checked={prefs.sound}
            onChange={(e) => setPrefs({ ...prefs, sound: e.target.checked })}
          />
          Sound
        </label>
        <label>
          <input type="checkbox" checked={prefs.desktop} onChange={(e) => void toggleDesktop(e.target.checked)} />
          Desktop notification when this tab is hidden
        </label>
      </div>

      {alerts.length === 0 ? (
        <div className="empty">
          <p>Waiting for flagged payments…</p>
          <p className="muted small">New alerts also pop up in the corner on every page.</p>
        </div>
      ) : (
        <div className="scroll">
          <table className="grid">
            <thead>
              <tr>
                <th>Time</th>
                <th>Card</th>
                <th>Merchant</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th>Decision</th>
                <th className="num">Score</th>
                <th>Rules</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.txnId} className="clickable" onClick={() => go({ page: 'card', cardId: a.cardId })}>
                  <td className="muted nowrap">{dateTime(a.ts)}</td>
                  <td className="mono">{a.cardId}</td>
                  <td>{a.merchant}</td>
                  <td className="muted">{category(a.category)}</td>
                  <td className="num">{vnd(a.amount)}</td>
                  <td>
                    <VerdictBadge verdict={a.decision} />
                  </td>
                  <td className="num">{score(a.score)}</td>
                  <td>
                    <div className="chips">
                      {a.firedRules.map((r) => (
                        <RuleChip key={r} ruleId={r} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
