import { HttpError, ME, request } from './http';
import type { Alert, Period, Recipient, RuleType, Txn } from './types';

export type Controls = {
  budget: { limit: number; period: Period; updatedAt: string | null } | null;
  merchantRules: { merchant: string; type: RuleType; createdAt: string }[];
};

export const fetchTransactions = () => request<Txn[]>('GET', `${ME}/transactions?limit=100`);

export const fetchAlerts = () => request<Alert[]>('GET', `${ME}/alerts?limit=100`);

export type Balance = { cardId: string; accountNumber: string; balance: number; currency: string; updatedAt: string };

export const fetchControls = () => request<Controls>('GET', `${ME}/controls`);

// Đồng, not USD like the card amounts: the account is a VND cash account.
export const fetchBalance = () => request<Balance>('GET', `${ME}/balance`);

export const fetchRecipients = () => request<Recipient[]>('GET', `${ME}/recipients`);

// Same-bank recipient check; null when no account has that number.
export async function fetchAccountHolder(accountNumber: string): Promise<string | null> {
  try {
    return (await request<{ name: string }>('GET', `/accounts/${encodeURIComponent(accountNumber)}`)).name;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
