import { cardPath, HttpError, request } from './http';
import type { Alert, Period, Recipient, RuleType, Txn } from './types';

export type Controls = {
  budget: { limit: number; period: Period; updatedAt: string | null } | null;
  merchantRules: { merchant: string; type: RuleType; createdAt: string }[];
};

export const fetchTransactions = (cardId: string) => request<Txn[]>('GET', `${cardPath(cardId)}/transactions?limit=100`);

export const fetchAlerts = (cardId: string) => request<Alert[]>('GET', `${cardPath(cardId)}/alerts?limit=100`);

export type Balance = { cardId: string; accountNumber: string; balance: number; currency: string; updatedAt: string };

export const fetchControls = (cardId: string) => request<Controls>('GET', `${cardPath(cardId)}/controls`);

// Đồng, not USD like the card amounts: the account is a VND cash account.
export const fetchBalance = (cardId: string) => request<Balance>('GET', `${cardPath(cardId)}/balance`);

export const fetchRecipients = (cardId: string) => request<Recipient[]>('GET', `${cardPath(cardId)}/recipients`);

// Same-bank recipient check; null when no account has that number.
export async function fetchAccountHolder(accountNumber: string): Promise<string | null> {
  try {
    return (await request<{ name: string }>('GET', `/accounts/${encodeURIComponent(accountNumber)}`)).name;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
