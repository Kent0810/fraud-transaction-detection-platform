// Response shapes. They match the mobile app's types (src/data/types.ts), so it can use them as-is.

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

export type AlertDto = {
  alertId: string;
  txnId: string;
  ruleId: string;
  ts: string;
  amount: number;
  merchant: string;
  status: 'OPEN' | 'CONFIRMED' | 'CLEARED';
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
