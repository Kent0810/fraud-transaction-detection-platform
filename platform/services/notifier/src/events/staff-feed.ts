const BLACKLISTED = 'R2';
const FRAUD_RECIPIENT = 'R3';

/**
 * What goes on the staff's live feed: every decline or step-up, and every payment to a fraud-marked recipient. Not a
 * decline the cardholder's own blacklist caused, which needs nobody's judgement.
 */
export function staffShouldSee(d: { decision: string; fired_rules: string[] }): boolean {
  if (d.fired_rules.includes(FRAUD_RECIPIENT)) return true;
  if (d.decision === 'ALLOW') return false;
  return d.fired_rules.some((rule) => rule !== BLACKLISTED);
}
