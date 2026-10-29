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

export type LiveAlertDto = {
  txnId: string;
  cardId: string;
  ts: string;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  decision: 'STEP_UP' | 'DECLINE';
  score: number;
  firedRules: string[];
};
