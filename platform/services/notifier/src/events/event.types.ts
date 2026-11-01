import { z } from 'zod';

export const DecisionMessage = z.object({
  txn_id: z.string(),
  card_id: z.string(),
  ts: z.string(),
  merchant: z.string(),
  category: z.string(),
  amount: z.number(),
  currency: z.string().nullish(),
  decision: z.enum(['ALLOW', 'STEP_UP', 'DECLINE']),
  score: z.number(),
  fired_rules: z.array(z.string()),
});

export const AlertMessage = z.object({
  card_id: z.string(),
  txn_id: z.string(),
  rule_id: z.string(),
  score: z.number(),
  amount: z.number(),
  ts: z.string(),
});

export const SettlementMessage = z.object({
  txn_id: z.string(),
  ts: z.string(),
  cc_num: z.string(),
  channel: z.enum(['CARD', 'TRANSFER']),
  amt: z.number(),
  status: z.enum(['POSTED', 'DECLINED']),
  declined_for: z.array(z.string()),
});

export const CreditMessage = z.object({
  txn_id: z.string(),
  ts: z.string(),
  cc_num: z.string(),
  merchant: z.string(),
  amount: z.number(),
});

export type LiveAlertDto = {
  txnId: string;
  cardId: string;
  ts: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  decision: 'ALLOW' | 'STEP_UP' | 'DECLINE';
  score: number;
  firedRules: string[];
};

export type CardNoticeDto = {
  kind: 'POSTED' | 'DECLINED' | 'RECEIVED' | 'ALERT';
  txnId: string;
  ts: string;
  channel: 'CARD' | 'TRANSFER';
  counterparty: string;
  amount: number;
  reasons: string[];
};
