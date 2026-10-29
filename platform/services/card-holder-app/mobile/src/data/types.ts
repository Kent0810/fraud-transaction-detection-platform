export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Channel = 'CARD' | 'TRANSFER';

export type Txn = {
  txnId: string;
  ts: string;
  channel: Channel;
  merchant: string;
  counterpartyAccount: string | null;
  category: string;
  amount: number;
  currency: string;
  decision: Verdict;
  score: number;
  firedRules: string[];
};

export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED';

export type Alert = {
  alertId: string;
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

export type Bank = {
  code: string;
  name: string;
};

export type Recipient = {
  bankCode: string;
  account: string;
  name: string;
};

export type TransferKind = 'INTERNAL' | 'NAPAS';

// PENDING until the bank's fraud check decides; only POSTED moved the money.
export type TransferStatus = 'PENDING' | 'POSTED' | 'DECLINED';

export type Transfer = {
  transferId: string;
  reference: string;
  kind: TransferKind;
  to: Recipient;
  amount: number;
  fee: number;
  content: string;
  status: TransferStatus;
  declinedFor: string[];
  ts: string;
};

export type RuleType = 'BLOCK' | 'ALLOW';

export type MerchantRule = {
  merchant: string;
  type: RuleType;
  createdAt: string;
  pending: boolean;
};
