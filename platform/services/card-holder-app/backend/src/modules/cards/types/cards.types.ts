export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Channel = 'CARD' | 'TRANSFER';

export type TxnDto = {
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
  // Null until the ledger has posted or declined it.
  status: 'POSTED' | 'DECLINED' | null;
  declinedFor: string[];
};

export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED';

export type AlertDto = {
  alertId: string;
  txnId: string;
  ruleId: string;
  ts: string;
  amount: number;
  merchant: string;
  status: AlertStatus;
};

export type CardStateDto = {
  cardId: string;
  riskScore: number;
  priority: number;
  amountSum: number;
  openAlerts: number;
  lastDecision: Verdict | null;
  updatedAt: string | null;
};
