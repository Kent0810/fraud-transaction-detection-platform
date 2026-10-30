import { ruleTitle } from '../data/rules';
import type { ReviewStatus, Verdict } from '../data/types';
import { Icon, type IconName } from './Icons';

const VERDICT: Record<Verdict, { label: string; icon: IconName }> = {
  ALLOW: { label: 'Allow', icon: 'check' },
  STEP_UP: { label: 'Step-up', icon: 'shield' },
  DECLINE: { label: 'Decline', icon: 'ban' },
};

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <span className="muted">—</span>;
  return (
    <span className={`verdict v-${verdict.toLowerCase()}`}>
      <Icon name={VERDICT[verdict].icon} size={12} strokeWidth={2.2} />
      {VERDICT[verdict].label}
    </span>
  );
}

export function RuleChip({
  ruleId,
  status,
  onClick,
  active,
  compact,
}: {
  ruleId: string;
  status?: ReviewStatus;
  onClick?: () => void;
  active?: boolean;
  compact?: boolean;
}) {
  const body = (
    <>
      <b>{ruleId}</b>
      {!compact && <span>{ruleTitle(ruleId)}</span>}
      {status && status !== 'OPEN' && <em>{status === 'CONFIRMED' ? 'fraud' : 'cleared'}</em>}
    </>
  );
  const className = `rule${status ? ` s-${status.toLowerCase()}` : ''}${active ? ' on' : ''}`;
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-pressed={active}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {body}
      </button>
    );
  }
  return (
    <span className={className} title={ruleTitle(ruleId)}>
      {body}
    </span>
  );
}

export function Kbd({ children }: { children: string }) {
  return <kbd>{children}</kbd>;
}
