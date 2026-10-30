export const RULE_TEXT: Record<string, { title: string; detail: string }> = {
  R1: { title: 'Many payments at once', detail: '5 or more payments on your card within a minute.' },
  R2: { title: 'Unusually large amount', detail: 'Much larger than your usual spending.' },
  R3: { title: 'Impossible travel', detail: 'In-person payments too far apart to travel between in time.' },
  R4: { title: 'New location burst', detail: 'Several payments right after first use in a new state.' },
  R5: { title: 'High-risk category', detail: 'A large payment in a category often targeted by fraud.' },
  R6: { title: 'Blocked merchant', detail: 'You blocked this merchant.' },
  BUDGET: { title: 'Over budget', detail: 'This payment takes you past your budget.' },
  FROZEN: { title: 'Card frozen', detail: 'You froze this card, so the payment was declined.' },
  LARGE_AMOUNT: { title: 'Unusually large transfer', detail: 'Transfers this large need extra verification.' },
  INSUFFICIENT_FUNDS: { title: 'Not enough balance', detail: 'Your balance did not cover it, so no money moved.' },
};

export function ruleTitle(ruleId: string): string {
  return RULE_TEXT[ruleId]?.title ?? ruleId;
}
