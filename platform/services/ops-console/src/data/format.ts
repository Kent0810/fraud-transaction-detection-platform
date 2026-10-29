export function vnd(amount: number): string {
  return `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;
}

export function category(raw: string): string {
  const suffix = raw.match(/_(net|pos)$/)?.[1];
  const label = raw
    .replace(/_(net|pos)$/, '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
  return suffix === 'net' ? `${label} · online` : suffix === 'pos' ? `${label} · in store` : label;
}

export function dateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ago(iso: string | null): string {
  if (!iso) return '—';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${Math.max(secs, 0)} s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export const score = (n: number) => n.toFixed(2);

export const accountNumber = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ');
