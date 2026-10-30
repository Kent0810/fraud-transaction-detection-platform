import type Ionicons from '@expo/vector-icons/Ionicons';

import { vnd } from './vnd';

export function money(dong: number): string {
  return vnd(dong);
}

// 190300000001 -> 1903 0000 0001, the way account numbers are printed.
export const accountNumber = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ');

export function category(raw: string): string {
  const suffix = raw.match(/_(net|pos)$/)?.[1];
  const label = raw
    .replace(/_(net|pos)$/, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
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
  transfer: 'paper-plane',
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
