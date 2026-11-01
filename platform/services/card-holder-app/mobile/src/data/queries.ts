import { HttpError, ME, request } from './http';
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
  RuleType,
  Transfer,
  Txn,
} from './types';

export type Controls = {
  budget: { limit: number; period: Period; updatedAt: string | null } | null;
  merchantRules: { merchant: string; type: RuleType; createdAt: string }[];
};

export const fetchTransactions = () => request<Txn[]>('GET', `${ME}/transactions?limit=100`);

export const fetchAlerts = () => request<Alert[]>('GET', `${ME}/alerts?limit=100`);

export type Balance = {
  cardId: string;
  accountNumber: string;
  balance: number;
  currency: string;
  updatedAt: string;
};

export const fetchControls = () => request<Controls>('GET', `${ME}/controls`);

// Đồng, not USD like the card amounts: the account is a VND cash account.
export const fetchBalance = () => request<Balance>('GET', `${ME}/balance`);

export const fetchRecipients = () => request<Recipient[]>('GET', `${ME}/recipients`);

export const fetchTransfer = (transferId: string) =>
  request<Transfer & { balance: number }>('GET', `${ME}/transfers/${encodeURIComponent(transferId)}`);

// One per category, nearest the cardholder's home first.
export const fetchMerchants = () => request<PayMerchant[]>('GET', `${ME}/payments/merchants`);

export const fetchPayment = (paymentId: string) =>
  request<Payment & { balance: number }>('GET', `${ME}/payments/${encodeURIComponent(paymentId)}`);

// This bank first, then the others a transfer can reach.
export const fetchBanks = () => request<Bank[]>('GET', `${ME}/transfers/banks`);

export const fetchProfile = () => request<Profile>('GET', `${ME}/profile`);

export const fetchMyQr = () => request<MyQr>('GET', `${ME}/qr`);

// A POST that changes nothing: the bank checks the code (checksum, signature, account) and says what it is for.
export const resolveQr = (payload: string) => request<QrTarget>('POST', `${ME}/qr/resolve`, { payload });

export type CardStatus = { frozen: boolean };

// From Postgres, so a freeze shows the moment it is saved.
export const fetchCardStatus = () => request<CardStatus>('GET', `${ME}/card`);

export async function fetchAccountHolder(accountNumber: string): Promise<string | null> {
  try {
    return (await request<{ name: string }>('GET', `/accounts/${encodeURIComponent(accountNumber)}`)).name;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
