import type { Alert, Bank, Budget, MerchantRule, Recipient, Transfer, Txn } from './types';

// Mock data only. Merchants and categories come from the Sparkov stream.
const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

// The cardholder's own payment account (VND). Transfers are sent from here.
export const ACCOUNT = { bankCode: 'DEMO', number: '1903 5566 7788', label: 'Payment account' };

// Mock bank list for the picker: short names only, no logos.
export const BANKS: Bank[] = [
  { code: 'DEMO', name: 'Demo Bank (same bank)' },
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

export const SAVED_RECIPIENTS: Recipient[] = [
  { bankCode: 'VCB', account: '0071000123456', name: 'NGUYEN VAN AN' },
  { bankCode: 'TCB', account: '19033445566017', name: 'TRAN THI BICH NGOC' },
  { bankCode: 'MB', account: '0901234567', name: 'LE MINH KHOA' },
  { bankCode: 'DEMO', account: '190355660011', name: 'PHAM THU HA' },
];

// Names handed out by the mock account lookup for numbers that aren't saved.
export const LOOKUP_NAMES = ['HOANG GIA BAO', 'VO THANH TAM', 'DANG NGOC LAN', 'BUI QUOC HUY', 'DO THI MAI'];

export const TRANSFERS: Transfer[] = [
  {
    transferId: 'FT26294718203',
    kind: 'NAPAS',
    to: SAVED_RECIPIENTS[1],
    amount: 350_000,
    fee: 0,
    content: 'JAMIE CARTER dinner',
    ts: minutesAgo(30 * 60),
  },
  {
    transferId: 'FT26290551874',
    kind: 'NAPAS',
    to: SAVED_RECIPIENTS[0],
    amount: 5_000_000,
    fee: 0,
    content: 'JAMIE CARTER October rent',
    ts: minutesAgo(4 * 24 * 60),
  },
];

export const TRANSACTIONS: Txn[] = [
  { txnId: 't-1009', ts: minutesAgo(3), merchant: 'Kuhn LLC', category: 'shopping_net', amount: 919.99, decision: 'DECLINE', score: 0.8, firedRules: ['R2', 'R5'] },
  { txnId: 't-1008', ts: minutesAgo(4), merchant: 'Kuhn LLC', category: 'shopping_net', amount: 845.1, decision: 'DECLINE', score: 0.8, firedRules: ['R2', 'R5'] },
  { txnId: 't-1007', ts: minutesAgo(6), merchant: 'Kuhn LLC', category: 'shopping_net', amount: 312.4, decision: 'ALLOW', score: 0.3, firedRules: ['R5'] },
  { txnId: 't-1006', ts: minutesAgo(95), merchant: 'Kirlin and Sons', category: 'personal_care', amount: 2.86, decision: 'ALLOW', score: 0, firedRules: [] },
  { txnId: 't-1005', ts: minutesAgo(180), merchant: 'Sporer-Keebler', category: 'personal_care', amount: 29.84, decision: 'ALLOW', score: 0, firedRules: [] },
  { txnId: 't-1004', ts: minutesAgo(26 * 60), merchant: 'Swaniawski, Nitzsche and Welch', category: 'health_fitness', amount: 41.28, decision: 'ALLOW', score: 0, firedRules: [] },
  { txnId: 't-1003', ts: minutesAgo(27 * 60), merchant: 'Haley Group', category: 'misc_pos', amount: 60.05, decision: 'STEP_UP', score: 0.4, firedRules: ['R4'] },
  { txnId: 't-1002', ts: minutesAgo(50 * 60), merchant: 'Johnston-Casper', category: 'travel', amount: 3.19, decision: 'ALLOW', score: 0, firedRules: [] },
  { txnId: 't-1001', ts: minutesAgo(52 * 60), merchant: 'Daugherty LLC', category: 'kids_pets', amount: 19.55, decision: 'ALLOW', score: 0, firedRules: [] },
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

export const BUDGET: Budget = { limit: 1500, period: 'MONTH', spent: 1144.12 };

export const MERCHANT_RULES: MerchantRule[] = [
  { merchant: 'Rippin, Kub and Mann', type: 'BLOCK', createdAt: minutesAgo(9 * 24 * 60), pending: false },
  { merchant: 'Kirlin and Sons', type: 'ALLOW', createdAt: minutesAgo(30 * 24 * 60), pending: false },
];
