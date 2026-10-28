export function vnd(amount: number): string {
  return `${groupThousands(Math.round(amount))} đ`;
}

export function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseVnd(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function readGroup(n: number): string {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) words.push(ONES[h], 'hundred');
  if (rest >= 20) words.push(rest % 10 ? `${TENS[Math.floor(rest / 10)]}-${ONES[rest % 10]}` : TENS[rest / 10]);
  else if (rest > 0) words.push(ONES[rest]);
  return words.join(' ');
}

export function vndInWords(amount: number): string {
  let n = Math.floor(amount);
  if (n <= 0) return '';
  const parts: string[] = [];
  for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
    const group = n % 1000;
    if (group) parts.unshift(`${readGroup(group)} ${SCALES[i]}`.trim());
  }
  const text = parts.join(' ');
  return `${text[0].toUpperCase()}${text.slice(1)} dong`;
}

export function toAccountName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}
