import { cardPath, request } from './http';
import type { Period, Recipient, RuleType } from './types';

const merchantPath = (cardId: string, merchant: string) =>
  `${cardPath(cardId)}/merchant-rules/${encodeURIComponent(merchant)}`;

export const setBudget = (cardId: string, limit: number, period: Period) =>
  request<void>('PUT', `${cardPath(cardId)}/budget`, { limit, period });

export const setMerchantRule = (cardId: string, merchant: string, type: RuleType) =>
  request<void>('PUT', merchantPath(cardId, merchant), { type });

export const releaseMerchant = (cardId: string, merchant: string) => request<void>('DELETE', merchantPath(cardId, merchant));

const recipientPath = (cardId: string, r: Recipient) =>
  `${cardPath(cardId)}/recipients/${encodeURIComponent(r.bankCode)}/${encodeURIComponent(r.account)}`;

export const saveRecipient = (cardId: string, r: Recipient) => request<void>('PUT', recipientPath(cardId, r), { name: r.name });

export const removeRecipient = (cardId: string, r: Recipient) => request<void>('DELETE', recipientPath(cardId, r));
