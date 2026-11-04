import { HttpError, request } from './http';
import type {
  Alert,
  Bank,
  MyQr,
  PayMerchant,
  Profile,
  Payment,
  Period,
  QrTarget,
  Recipient,
  Transfer,
  Txn,
} from './types';

export type Controls = {
  budget: { limit: number; period: Period; updatedAt: string | null } | null;
};

export const fetchTransactions = () => request<Txn[]>('GET', '/me/transactions?limit=100');

export const fetchAlerts = () => request<Alert[]>('GET', '/me/alerts?limit=100');

export type Balance = {
  cardId: string;
  accountNumber: string;
  balance: number;
  currency: string;
  updatedAt: string;
};

export const fetchControls = () => request<Controls>('GET', '/me/controls');

// Đồng, not USD like the card amounts: the account is a VND cash account.
export const fetchBalance = () => request<Balance>('GET', '/me/balance');

export const fetchRecipients = () => request<Recipient[]>('GET', '/me/recipients');

export const fetchTransfer = (transferId: string) =>
  request<Transfer & { balance: number }>('GET', `/me/transfers/${encodeURIComponent(transferId)}`);

// One per category, nearest the cardholder's home first.
export const fetchMerchants = () => request<PayMerchant[]>('GET', '/me/payments/merchants');

export const fetchPayment = (paymentId: string) =>
  request<Payment & { balance: number }>('GET', `/me/payments/${encodeURIComponent(paymentId)}`);

// This bank first, then the others a transfer can reach.
export const fetchBanks = () => request<Bank[]>('GET', '/me/transfers/banks');

export const fetchProfile = () => request<Profile>('GET', '/me/profile');

export const fetchMyQr = () => request<MyQr>('GET', '/me/qr');

// A POST that changes nothing: the bank checks the code (checksum, signature, account) and says what it is for.
export const resolveQr = (payload: string) => request<QrTarget>('POST', '/me/qr/resolve', { payload });

export type CardStatus = { frozen: boolean };

// From Postgres, so a freeze shows the moment it is saved.
export const fetchCardStatus = () => request<CardStatus>('GET', '/me/card');

export async function fetchAccountHolder(accountNumber: string): Promise<string | null> {
  try {
    return (await request<{ name: string }>('GET', `/accounts/${encodeURIComponent(accountNumber)}`)).name;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
