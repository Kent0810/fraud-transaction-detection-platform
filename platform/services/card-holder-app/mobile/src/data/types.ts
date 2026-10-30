export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Channel = 'CARD' | 'TRANSFER';

export type Txn = {
  txnId: string;
  ts: string;
  channel: Channel;
  merchant: string;
  recipientAccount: string | null;
  category: string;
  amount: number;
  currency: string;
  decision: Verdict;
  score: number;
  firedRules: string[];
  // Null until the ledger has posted or declined it (never for a fraud DECLINE).
  status: 'POSTED' | 'DECLINED' | null;
  declinedFor: string[];
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

// Always an account at this bank: transfers to other banks are not supported.
export type Recipient = {
  account: string;
  name: string;
};

// PENDING until the bank's fraud check decides; only POSTED moved the money.
export type TransferStatus = 'PENDING' | 'POSTED' | 'DECLINED';

export type Transfer = {
  transferId: string;
  reference: string;
  to: Recipient;
  amount: number;
  fee: number;
  content: string;
  status: TransferStatus;
  declinedFor: string[];
  ts: string;
};

// A merchant near the cardholder, from the dataset; paying one is a card payment like any other.
export type PayMerchant = {
  merchantId: string;
  name: string;
  category: string;
  distanceKm: number | null;
};

// A card payment made in the app. PENDING until the fraud check decides; only POSTED moved the money.
export type Payment = {
  paymentId: string;
  reference: string;
  merchant: string;
  category: string;
  amount: number;
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
