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

/** An alert from the alerts topic: its own message, without the transaction's details. */
export const AlertMessage = z.object({
  card_id: z.string(),
  txn_id: z.string(),
  rule_id: z.string(),
  score: z.number(),
  amount: z.number(),
  ts: z.string(),
});

export type LiveAlertDto = {
  txnId: string;
  cardId: string;
  ts: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  // ALLOW: the payment went through, but a rule raised an alert on it anyway (an alert-only rule).
  decision: 'ALLOW' | 'STEP_UP' | 'DECLINE';
  score: number;
  firedRules: string[];
};
