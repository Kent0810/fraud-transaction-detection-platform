import { ME, request } from './http';
import type { Period, Recipient, RuleType, Transfer } from './types';

const merchantPath = (merchant: string) => `${ME}/merchant-rules/${encodeURIComponent(merchant)}`;

export const setBudget = (limit: number, period: Period) => request<void>('PUT', `${ME}/budget`, { limit, period });

export const setMerchantRule = (merchant: string, type: RuleType) =>
  request<void>('PUT', merchantPath(merchant), { type });

export const releaseMerchant = (merchant: string) => request<void>('DELETE', merchantPath(merchant));

const recipientPath = (r: Recipient) =>
  `${ME}/recipients/${encodeURIComponent(r.bankCode)}/${encodeURIComponent(r.account)}`;

export const saveRecipient = (r: Recipient) => request<void>('PUT', recipientPath(r), { name: r.name });

export const removeRecipient = (r: Recipient) => request<void>('DELETE', recipientPath(r));

export type SendTransfer = {
  transferId: string;
  to: Recipient;
  amount: number;
  content: string;
  password: string;
};

// balance: the sender's balance after the transfer, straight from the ledger.
export const sendTransfer = (t: SendTransfer) =>
  request<Transfer & { reference: string; balance: number }>('POST', `${ME}/transfers`, {
    transferId: t.transferId,
    toBankCode: t.to.bankCode,
    toAccount: t.to.account,
    toName: t.to.name,
    amount: t.amount,
    content: t.content,
    password: t.password,
  });

// The idempotency key for one transfer: made once per confirm screen, so a retry after a timeout can't send twice.
// Only needs to be unique, not secret, so Math.random is enough where crypto.randomUUID isn't available.
export function newTransferId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}
