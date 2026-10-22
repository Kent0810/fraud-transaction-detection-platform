import type { Alert, Txn } from './types';

// Set in mobile/.env (see .env.example). Without EXPO_PUBLIC_API_URL the app runs on mock data.
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const CARD_ID = process.env.EXPO_PUBLIC_CARD_ID;

export const apiEnabled = !!API_URL;
export const apiUrl = API_URL;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  return (await res.json()) as T;
}

// The configured card, or else the first card the backend has data for (handy for the demo).
export async function resolveCardId(): Promise<string | null> {
  if (CARD_ID) return CARD_ID;
  const cards = await get<string[]>('/cards?limit=1');
  return cards[0] ?? null;
}

export const fetchTransactions = (cardId: string) =>
  get<Txn[]>(`/cards/${encodeURIComponent(cardId)}/transactions?limit=100`);

export const fetchAlerts = (cardId: string) => get<Alert[]>(`/cards/${encodeURIComponent(cardId)}/alerts?limit=100`);
