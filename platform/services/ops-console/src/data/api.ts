import { request } from './http';
import type {
  Activity,
  AuditEntry,
  CardView,
  LoginStatus,
  QueueItem,
  RuleType,
  StaffMember,
  StaffSession,
} from './types';

const card = (cardId: string) => `/ops/cards/${encodeURIComponent(cardId)}`;

export const login = (email: string, password: string) =>
  request<StaffSession>('POST', '/ops/auth/login', { email, password });

export const logout = () => request<void>('POST', '/ops/auth/logout');

export const me = () => request<StaffMember>('GET', '/ops/auth/me');

export const fetchQueue = () => request<QueueItem[]>('GET', '/ops/queue');

export const findCard = (q: string) => request<{ cardId: string }>('GET', `/ops/cards?q=${encodeURIComponent(q)}`);

export const openCard = (cardId: string) => request<CardView>('GET', card(cardId));

export const fetchActivity = (cardId: string, days: number) =>
  request<Activity[]>('GET', `${card(cardId)}/activity?days=${days}`);

export const fetchAudit = (cardId: string) => request<AuditEntry[]>('GET', `${card(cardId)}/audit`);

export const reviewAlert = (
  cardId: string,
  alert: { alertId: string; ts: string },
  status: 'CONFIRMED' | 'CLEARED',
  reason: string | null,
) =>
  request<void>('PUT', `${card(cardId)}/alerts/${encodeURIComponent(alert.alertId)}`, {
    ts: alert.ts,
    status,
    reason,
  });

export const setMerchantRule = (cardId: string, merchant: string, type: RuleType, reason: string | null) =>
  request<void>('PUT', `${card(cardId)}/merchant-rules/${encodeURIComponent(merchant)}`, { type, reason });

export const releaseMerchant = (cardId: string, merchant: string, reason: string | null) =>
  request<void>('DELETE', `${card(cardId)}/merchant-rules/${encodeURIComponent(merchant)}`, { reason });

export const setFrozen = (cardId: string, frozen: boolean, reason: string | null) =>
  request<{ frozen: boolean }>('POST', `${card(cardId)}/${frozen ? 'freeze' : 'unfreeze'}`, { reason });

export const setLoginEnabled = (cardId: string, enabled: boolean, reason: string | null) =>
  request<{ status: LoginStatus }>('POST', `${card(cardId)}/login/${enabled ? 'restore' : 'disable'}`, { reason });

export type MerchantRef = { merchantId: string; name: string; category: string };

export type MerchantQr = { payload: string; merchant: MerchantRef; amount: number | null; expiresAt: string | null };

export const searchMerchants = (q: string) =>
  request<MerchantRef[]>('GET', `/ops/merchants?q=${encodeURIComponent(q)}`);

// amount set: a dynamic code the payer must pay exactly, valid for 10 minutes. null: a static counter code.
export const merchantQr = (merchantId: string, amount: number | null) =>
  request<MerchantQr>('POST', `/ops/merchants/${encodeURIComponent(merchantId)}/qr`, { amount });

/** A card this staff member opened, from their own audit rows (newest first, each card once). */
export type RecentCard = { cardId: string; name: string; openedAt: string };

export const fetchRecentCards = () => request<RecentCard[]>('GET', '/ops/recent-cards');
