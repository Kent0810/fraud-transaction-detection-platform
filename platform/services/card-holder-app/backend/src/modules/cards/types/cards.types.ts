export type Verdict = 'ALLOW' | 'STEP_UP' | 'DECLINE';

export type Channel = 'CARD' | 'TRANSFER';

export type TxnDto = {
  txnId: string;
  ts: string;
  channel: Channel;
  // IN: money received from another card of this bank (merchant and recipientAccount are then the sender's).
  direction: 'IN' | 'OUT';
  merchant: string;
  recipientAccount: string | null;
  category: string;
  amount: number;
  currency: string;
  // Where a card payment was made; null for transfers.
  merchLat: number | null;
  merchLong: number | null;
  decision: Verdict;
  score: number;
  firedRules: string[];
  // Null until the ledger has posted or declined it; HELD while a stepped-up transfer waits for an agent.
  status: 'HELD' | 'POSTED' | 'DECLINED' | null;
  declinedFor: string[];
};

// APPROVED: a flag on a payment that went through (e.g. over budget); nobody reviews it.
export type AlertStatus = 'OPEN' | 'CONFIRMED' | 'CLEARED' | 'APPROVED';

export type AlertDto = {
  alertId: string;
  txnId: string;
  ruleId: string;
  ts: string;
  amount: number;
  merchant: string;
  status: AlertStatus;
};
