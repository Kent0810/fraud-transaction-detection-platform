export const RULE_TEXT: Record<string, { title: string; detail: string }> = {
  R1: { title: 'Many payments at once', detail: '5 or more payments on your card within a minute.' },
  R3: { title: 'Impossible travel', detail: 'In-person payments too far apart to travel between in time.' },
  R4: { title: 'New location burst', detail: 'Several payments right after first use in a new state.' },
  R5: { title: 'High-risk category', detail: 'A large payment in a category often targeted by fraud.' },
  BLOCKED_RECIPIENT: { title: 'Blocked recipient', detail: 'You asked the bank to block this recipient.' },
  BUDGET: { title: 'Over budget', detail: 'This payment takes you past your budget.' },
  FROZEN: { title: 'Card frozen', detail: 'You froze this card, so the payment was declined.' },
  AMOUNT_SPIKE: {
    title: 'Unusually large transfer',
    detail: 'Much larger than your usual transfers, so the bank confirms it with you first.',
  },
  REJECTED_BY_BANK: { title: 'Rejected by the bank', detail: 'You told us you did not make this transfer.' },
  NOT_CONFIRMED: {
    title: 'Not confirmed in time',
    detail: 'The bank could not confirm this transfer within 24 hours.',
  },
  INSUFFICIENT_FUNDS: { title: 'Not enough balance', detail: 'Your balance did not cover it, so no money moved.' },
};

export function ruleTitle(ruleId: string): string {
  return RULE_TEXT[ruleId]?.title ?? ruleId;
}
