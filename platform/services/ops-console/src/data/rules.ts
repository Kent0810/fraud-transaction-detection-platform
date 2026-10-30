export const RULE_TITLE: Record<string, string> = {
  R1: 'Velocity',
  R2: 'Amount spike',
  R3: 'Impossible travel',
  R4: 'New-region burst',
  R5: 'High-risk category',
  R6: 'Blocked merchant',
  BUDGET: 'Over budget',
  FROZEN: 'Card frozen',
  LARGE_AMOUNT: 'Large transfer',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
};

export const ruleTitle = (id: string) => RULE_TITLE[id] ?? id;

export const ACTION_LABEL: Record<string, string> = {
  VIEW_CARDHOLDER: 'Opened the cardholder file',
  BLOCK_MERCHANT: 'Blocked a merchant',
  ALLOW_MERCHANT: 'Allowed a merchant',
  RELEASE_MERCHANT: 'Removed a merchant rule',
  FREEZE_CARD: 'Froze the card',
  UNFREEZE_CARD: 'Unfroze the card',
  CONFIRM_ALERT: 'Confirmed an alert as fraud',
  CLEAR_ALERT: 'Cleared an alert',
  DISABLE_LOGIN: 'Turned off app sign-in',
  RESTORE_LOGIN: 'Restored app sign-in',
};
