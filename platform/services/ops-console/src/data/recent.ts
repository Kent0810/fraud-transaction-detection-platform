const KEY = 'ops-console.recent-cards';
const KEEP = 8;

export type RecentCard = {
  cardId: string;
  name: string;
  openedAt: string;
};

export function recentCards(): RecentCard[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentCard[]) : [];
  } catch {
    return [];
  }
}

export function rememberCard(cardId: string, name: string) {
  const next = [
    { cardId, name, openedAt: new Date().toISOString() },
    ...recentCards().filter((c) => c.cardId !== cardId),
  ].slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Recent cards are a convenience; nothing to do without storage.
  }
}
