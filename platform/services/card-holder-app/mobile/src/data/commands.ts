import { BANK_SHORT } from '@/components/brand';

import { ME, request } from './http';
import type { CardStatus } from './queries';
import type { Payment, Period, Recipient, RuleType, Transfer } from './types';

export const freezeCard = () => request<CardStatus>('POST', `${ME}/card/freeze`);

export const unfreezeCard = (password: string) => request<CardStatus>('POST', `${ME}/card/unfreeze`, { password });

const merchantPath = (merchant: string) => `${ME}/merchant-rules/${encodeURIComponent(merchant)}`;

export const setBudget = (limit: number, period: Period) => request<void>('PUT', `${ME}/budget`, { limit, period });

export const setMerchantRule = (merchant: string, type: RuleType) =>
  request<void>('PUT', merchantPath(merchant), { type });

export const releaseMerchant = (merchant: string) => request<void>('DELETE', merchantPath(merchant));

// Recipients are always at this bank; the API still names the bank in the path.
const recipientPath = (r: Recipient) => `${ME}/recipients/${BANK_SHORT}/${encodeURIComponent(r.account)}`;

export const saveRecipient = (r: Recipient) => request<void>('PUT', recipientPath(r), { name: r.name });

export const removeRecipient = (r: Recipient) => request<void>('DELETE', recipientPath(r));

export type SendTransfer = {
  transferId: string;
  to: Recipient;
  amount: number;
  content: string;
  password: string;
};

// Recorded as PENDING: the fraud check decides, then the money moves (or doesn't). Poll fetchTransfer for the outcome.
// balance: the sender's balance now, straight from the ledger.
export const sendTransfer = (t: SendTransfer) =>
  request<Transfer & { balance: number }>('POST', `${ME}/transfers`, {
    transferId: t.transferId,
    toAccount: t.to.account,
    amount: t.amount,
    content: t.content,
    password: t.password,
  });

export type SendPayment = {
  paymentId: string;
  merchantId: string;
  amount: number;
  password: string;
};

// Recorded as PENDING like a transfer; poll fetchPayment for the outcome. balance: the card's balance now.
export const sendPayment = (p: SendPayment) => request<Payment & { balance: number }>('POST', `${ME}/payments`, p);

// The idempotency key for one transfer or payment: made once per confirm screen, so a retry after a timeout can't send twice.
// Only needs to be unique, not secret, so Math.random is enough where crypto.randomUUID isn't available.
export function newTransferId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}
