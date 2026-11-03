/**
 * Who a transaction pays, as one string, so a blacklist, a whitelist and a fraud mark all mean the same recipient.
 * RecipientId.java in the fraud detector builds the same ids from each transaction: keep them in step.
 *   account:<bank code>:<account number>   matched by account, never by the name typed on a transfer
 *   merchant:<name>                        ignoring case and surrounding spaces
 */
export type Recipient = { id: string; name: string };

export function merchantRecipient(name: string): Recipient {
  const shown = name.trim();
  return { id: `merchant:${shown.toLowerCase()}`, name: shown };
}

/** @param account `<bank code>:<account number>`, as a transaction's recipient_account has it */
export function accountRecipient(account: string, name?: string | null): Recipient {
  const normal = account.trim().toUpperCase();
  return { id: `account:${normal}`, name: name?.trim() || normal };
}

export function txnRecipient(t: { channel: string; merchant: string; recipientAccount: string | null }): Recipient {
  return t.channel === 'TRANSFER' && t.recipientAccount
    ? accountRecipient(t.recipientAccount, t.merchant)
    : merchantRecipient(t.merchant);
}
