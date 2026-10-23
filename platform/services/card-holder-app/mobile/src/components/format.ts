import type Ionicons from '@expo/vector-icons/Ionicons';

import { vnd } from './vnd';

// Card amounts come from the backend in US dollars (the fraud dataset's currency); the app shows đồng.
export const VND_PER_USD = 25_000;

export const toVnd = (usd: number) => Math.round(usd * VND_PER_USD);

export const toUsd = (dong: number) => Math.round((dong / VND_PER_USD) * 100) / 100;

export function money(usd: number): string {
  return vnd(toVnd(usd));
}

export function category(raw: string): string {
  const suffix = raw.match(/_(net|pos)$/)?.[1];
  const label = raw.replace(/_(net|pos)$/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return suffix === 'net' ? `${label} · Online` : suffix === 'pos' ? `${label} · In store` : label;
}

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICON: Record<string, IconName> = {
  shopping: 'bag-handle',
  grocery: 'cart',
  gas: 'car',
  food: 'restaurant',
  health: 'fitness',
  personal: 'sparkles',
  entertainment: 'film',
  travel: 'airplane',
  kids: 'paw',
  home: 'home',
  misc: 'apps',
};

export function categoryIcon(raw: string): IconName {
  return CATEGORY_ICON[raw.split('_')[0]] ?? 'card';
}

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function day(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function relative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export const PERIOD_LABEL = { DAY: 'day', WEEK: 'week', MONTH: 'month' } as const;
