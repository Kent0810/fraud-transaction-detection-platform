import { cardPath, request } from './http';
import type { Alert, Period, RuleType, Txn } from './types';

export type Controls = {
  budget: { limit: number; period: Period; updatedAt: string | null } | null;
  merchantRules: { merchant: string; type: RuleType; createdAt: string }[];
};

export const fetchTransactions = (cardId: string) => request<Txn[]>('GET', `${cardPath(cardId)}/transactions?limit=100`);

export const fetchAlerts = (cardId: string) => request<Alert[]>('GET', `${cardPath(cardId)}/alerts?limit=100`);

export const fetchControls = (cardId: string) => request<Controls>('GET', `${cardPath(cardId)}/controls`);
