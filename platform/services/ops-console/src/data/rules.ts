export const RULE_TITLE: Record<string, string> = {
  R1: 'Velocity',
  R2: 'Amount spike',
  R3: 'Impossible travel',
  R4: 'New-region burst',
  R5: 'High-risk category',
  R6: 'Blacklisted recipient',
  FRAUD_RECIPIENT: 'Recipient marked as fraud',
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
  BLOCK_RECIPIENT: 'Blacklisted a recipient',
  ALLOW_RECIPIENT: 'Whitelisted a recipient',
  RELEASE_RECIPIENT: 'Removed a recipient rule',
  CUSTOMER_GENUINE: 'Cardholder confirmed the payment',
  CUSTOMER_FRAUD: 'Cardholder denied the payment',
  REMOVE_FRAUD_MARK: 'Removed a fraud mark',
  FREEZE_CARD: 'Froze the card',
  UNFREEZE_CARD: 'Unfroze the card',
  CONFIRM_ALERT: 'Confirmed an alert as fraud',
  CLEAR_ALERT: 'Cleared an alert',
  DISABLE_LOGIN: 'Turned off app sign-in',
  RESTORE_LOGIN: 'Restored app sign-in',
};

/** The fraud detector's id for who a transaction paid (RecipientId.java), to find this card's rule for it. */
export function recipientIdOf(t: { channel: string; merchant: string; recipientAccount: string | null }): string {
  return t.channel === 'TRANSFER' && t.recipientAccount
    ? `account:${t.recipientAccount.toUpperCase()}`
    : `merchant:${t.merchant.trim().toLowerCase()}`;
}
