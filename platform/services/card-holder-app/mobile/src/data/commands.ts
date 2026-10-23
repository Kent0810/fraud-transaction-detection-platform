import { cardPath, request } from './http';
import type { Period, RuleType } from './types';

const merchantPath = (cardId: string, merchant: string) =>
  `${cardPath(cardId)}/merchant-rules/${encodeURIComponent(merchant)}`;

export const setBudget = (cardId: string, limit: number, period: Period) =>
  request<void>('PUT', `${cardPath(cardId)}/budget`, { limit, period });

export const setMerchantRule = (cardId: string, merchant: string, type: RuleType) =>
  request<void>('PUT', merchantPath(cardId, merchant), { type });

export const releaseMerchant = (cardId: string, merchant: string) => request<void>('DELETE', merchantPath(cardId, merchant));
