export const RULE_TEXT: Record<string, { title: string; detail: string }> = {
  R1: { title: 'Card frozen', detail: 'You froze this card, so the payment was declined.' },
  R2: { title: 'Blocked recipient', detail: 'You asked the bank to block this recipient.' },
  R4: {
    title: 'Unusually large amount',
    detail: 'Much larger than what you usually spend: a transfer waits for the bank to confirm it with you.',
  },
  R5: { title: 'Many payments at once', detail: '5 or more payments on your card within an hour.' },
  R6: { title: 'Impossible travel', detail: 'In-person payments too far apart to travel between in time.' },
  R7: { title: 'Over budget', detail: 'This payment takes you past your budget.' },
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
