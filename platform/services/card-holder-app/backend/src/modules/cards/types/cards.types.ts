export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type TxnDto = {
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
