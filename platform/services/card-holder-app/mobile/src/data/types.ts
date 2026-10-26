export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Txn = {
  txnId: string;
  ts: string;
  merchant: string;
  category: string;
  amount: number;
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

export type Transfer = {
  transferId: string;
  reference: string;
  kind: TransferKind;
  to: Recipient;
  amount: number;
  fee: number;
  content: string;
  ts: string;
};

export type RuleType = 'BLOCK' | 'ALLOW';

export type MerchantRule = {
  merchant: string;
  type: RuleType;
  createdAt: string;
  pending: boolean;
};
