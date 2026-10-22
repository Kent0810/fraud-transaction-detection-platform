// Shapes mirror the Cassandra tables (txn_by_card, alerts_by_card) and the
// Postgres reference data (budgets, merchant rules) the app will read later.

export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Txn = {
  txnId: string;
  ts: string; // ISO-8601
  merchant: string;
  category: string;
  amount: number;
  decision: Verdict;
  score: number;
  firedRules: string[];
};

export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED';

export type Alert = {
  alertId: string; // txn_id:rule_id
  txnId: string;
  ruleId: string;
  ts: string;
  amount: number;
  merchant: string;
  status: AlertStatus;
};

export type Period = 'DAY' | 'WEEK' | 'MONTH';

export type Budget = {
  limit: number;
  period: Period;
  spent: number;
};

// Transfers follow Vietnamese banking: VND amounts, account names in upper case without accents.
export type Bank = {
  code: string; // short name shown in the app, e.g. VCB
  name: string;
};

export type Recipient = {
  bankCode: string;
  account: string;
  name: string; // e.g. NGUYEN VAN AN
};

export type TransferKind = 'INTERNAL' | 'NAPAS'; // same bank, or another bank via NAPAS 247

export type Transfer = {
  transferId: string; // reference shown on the receipt
  kind: TransferKind;
  to: Recipient;
  amount: number; // VND
  fee: number; // VND
  content: string; // transfer message
  ts: string;
};

export type RuleType = 'BLOCK' | 'ALLOW';

export type MerchantRule = {
  merchant: string;
  type: RuleType;
  createdAt: string;
  // A change goes Postgres -> outbox -> Kafka before the rules app enforces it.
  pending: boolean;
};
