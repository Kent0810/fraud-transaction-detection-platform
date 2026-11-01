import type { Alert, Bank, Budget, MerchantRule, PayMerchant, Txn } from './types';

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

// number is the mock build's; with the API the real one comes from GET /cards/:id/balance.
export const ACCOUNT = { number: '190300000001', label: 'Payment account' };

/** This bank, as the bank list names it; offline, the only bank shown. */
export const OUR_BANK: Bank = { bin: '970999', code: 'HCMMB', name: 'HCM Mock Banking' };

export const LOOKUP_NAMES = ['HOANG GIA BAO', 'VO THANH TAM', 'DANG NGOC LAN', 'BUI QUOC HUY', 'DO THI MAI'];

const MOCK_TXNS: Omit<Txn, 'status' | 'declinedFor'>[] = [
  {
    txnId: 't-1009',
    ts: minutesAgo(3),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Kuhn LLC',
    recipientAccount: null,
    category: 'shopping_net',
    amount: 22_999_750,
    currency: 'VND',
    decision: 'DECLINE',
    score: 0.8,
    firedRules: ['R2', 'R5'],
  },
  {
    txnId: 't-1008',
    ts: minutesAgo(4),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Kuhn LLC',
    recipientAccount: null,
    category: 'shopping_net',
    amount: 21_127_500,
    currency: 'VND',
    decision: 'DECLINE',
    score: 0.8,
    firedRules: ['R2', 'R5'],
  },
  {
    txnId: 't-1007',
    ts: minutesAgo(6),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Kuhn LLC',
    recipientAccount: null,
    category: 'shopping_net',
    amount: 7_810_000,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0.3,
    firedRules: ['R5'],
  },
  {
    txnId: 't-1006',
    ts: minutesAgo(95),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Kirlin and Sons',
    recipientAccount: null,
    category: 'personal_care',
    amount: 71_500,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0,
    firedRules: [],
  },
  {
    txnId: 't-1005',
    ts: minutesAgo(180),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Sporer-Keebler',
    recipientAccount: null,
    category: 'personal_care',
    amount: 746_000,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0,
    firedRules: [],
  },
  {
    txnId: 't-1004',
    ts: minutesAgo(26 * 60),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Swaniawski, Nitzsche and Welch',
    recipientAccount: null,
    category: 'health_fitness',
    amount: 1_032_000,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0,
    firedRules: [],
  },
  {
    txnId: 't-1003',
    ts: minutesAgo(27 * 60),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Haley Group',
    recipientAccount: null,
    category: 'misc_pos',
    amount: 1_501_250,
    currency: 'VND',
    decision: 'STEP_UP',
    score: 0.4,
    firedRules: ['R4'],
  },
  {
    txnId: 't-1002',
    ts: minutesAgo(50 * 60),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Johnston-Casper',
    recipientAccount: null,
    category: 'travel',
    amount: 79_750,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0,
    firedRules: [],
  },
  {
    txnId: 't-1001',
    ts: minutesAgo(52 * 60),
    channel: 'CARD',
    direction: 'OUT',
    merchant: 'Daugherty LLC',
    recipientAccount: null,
    category: 'kids_pets',
    amount: 488_750,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0,
    firedRules: [],
  },
];

// Only an approved payment reaches the ledger; the mock build's balance always covers it.
export const TRANSACTIONS: Txn[] = MOCK_TXNS.map((t) => ({
  ...t,
  status: t.decision === 'ALLOW' ? 'POSTED' : null,
  declinedFor: [],
}));

export const ALERTS: Alert[] = TRANSACTIONS.flatMap((t) =>
  t.firedRules.map((ruleId) => ({
    alertId: `${t.txnId}:${ruleId}`,
    txnId: t.txnId,
    ruleId,
    ts: t.ts,
    amount: t.amount,
    merchant: t.merchant,
    status: t.decision === 'ALLOW' ? ('CLEARED' as const) : ('OPEN' as const),
  })),
);

export const BUDGET: Budget = { limit: 37_500_000, period: 'MONTH', spent: 28_603_000 };

export const MERCHANT_RULES: MerchantRule[] = [
  { merchant: 'Rippin, Kub and Mann', type: 'BLOCK', createdAt: minutesAgo(9 * 24 * 60), pending: false },
  { merchant: 'Kirlin and Sons', type: 'ALLOW', createdAt: minutesAgo(30 * 24 * 60), pending: false },
];

export const PAY_MERCHANTS: PayMerchant[] = [
  { merchantId: '0', name: 'Kirlin and Sons', category: 'personal_care', distanceKm: 0.8 },
  { merchantId: '1', name: 'Sporer-Keebler', category: 'grocery_pos', distanceKm: 1.4 },
  { merchantId: '2', name: 'Bahringer, Schoen and Corkery', category: 'food_dining', distanceKm: 2.3 },
  { merchantId: '3', name: 'Kuvalis Ltd', category: 'gas_transport', distanceKm: 3.1 },
  { merchantId: '4', name: 'Stroman, Hudson and Erdman', category: 'shopping_pos', distanceKm: 5.6 },
];
