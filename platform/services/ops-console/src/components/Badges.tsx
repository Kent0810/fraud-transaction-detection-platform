import { ruleTitle } from '../data/rules';
import type { ReviewStatus, Verdict } from '../data/types';

const VERDICT_LABEL: Record<Verdict, string> = {
  ALLOW: 'Allow',
  STEP_UP: 'Step-up',
  DECLINE: 'Decline',
};

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="muted">—</span>;
  return <span className={`verdict v-${verdict.toLowerCase()}`}>{VERDICT_LABEL[verdict]}</span>;
}

export function RuleChip({ ruleId, status }: { ruleId: string; status?: ReviewStatus }) {
  return (
    <span className={`rule${status ? ` s-${status.toLowerCase()}` : ''}`} title={ruleTitle(ruleId)}>
      <b>{ruleId}</b>
      {ruleTitle(ruleId)}
      {status && status !== 'OPEN' && <em>{status === 'CONFIRMED' ? 'fraud' : 'cleared'}</em>}
    </span>
  );
}
