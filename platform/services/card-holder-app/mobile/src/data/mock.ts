import { BANK_NAME, BANK_SHORT } from '@/components/brand';

import type { Alert, Bank, Budget, MerchantRule, Txn } from './types';

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

// number is the mock build's; with the API the real one comes from GET /cards/:id/balance.
export const ACCOUNT = { bankCode: BANK_SHORT, number: '190300000001', label: 'Payment account' };

export const BANKS: Bank[] = [
  { code: BANK_SHORT, name: `${BANK_NAME} (internal transfer)` },
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VTB', name: 'VietinBank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
];

export const LOOKUP_NAMES = ['HOANG GIA BAO', 'VO THANH TAM', 'DANG NGOC LAN', 'BUI QUOC HUY', 'DO THI MAI'];

export const TRANSACTIONS: Txn[] = [
  {
    txnId: 't-1009',
    ts: minutesAgo(3),
    channel: 'CARD',
    merchant: 'Kuhn LLC',
    counterpartyAccount: null,
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
    merchant: 'Kuhn LLC',
    counterpartyAccount: null,
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
    merchant: 'Kuhn LLC',
    counterpartyAccount: null,
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
    merchant: 'Kirlin and Sons',
    counterpartyAccount: null,
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
    merchant: 'Sporer-Keebler',
    counterpartyAccount: null,
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
    merchant: 'Swaniawski, Nitzsche and Welch',
    counterpartyAccount: null,
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
    merchant: 'Haley Group',
    counterpartyAccount: null,
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
    merchant: 'Johnston-Casper',
    counterpartyAccount: null,
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
    merchant: 'Daugherty LLC',
    counterpartyAccount: null,
    category: 'kids_pets',
    amount: 488_750,
    currency: 'VND',
    decision: 'ALLOW',
    score: 0,
    firedRules: [],
  },
];

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
