import type { Bank, TransactionStatus } from '@platform/db';
import { z } from 'zod';

import { AccountNumber, Password, text } from '../../../common/validation';

export { OUR_BANK } from '@platform/db';

export const TransferRequest = z.object({
  transferId: z.uuid().transform((id) => id.toLowerCase()),
  // Another bank's id (BIN); absent for this bank. Its accounts can be any 6 to 19 digits.
  toBank: z
    .string()
    .regex(/^\d{6}$/, 'must be a 6-digit bank id')
    .optional(),
  toAccount: AccountNumber,
  // Only for another bank, where nobody here can look the name up.
  toName: text(50).optional(),
  // Whole đồng; int() also caps it at Number.MAX_SAFE_INTEGER.
  amount: z.number().int().positive(),
  content: text(140),
  password: Password,
});
export type TransferRequest = z.infer<typeof TransferRequest>;

export const TransferId = z.uuid().transform((id) => id.toLowerCase());

export const DecisionMessage = z.object({
  txn_id: z.string().min(1),
  card_id: z.string().min(1),
  ts: z.string().min(1),
  channel: z.enum(['CARD', 'TRANSFER']),
  merchant: z.string().nullish(),
  category: z.string().nullish(),
  amount: z.number(),
  merch_lat: z.number().nullish(),
  merch_long: z.number().nullish(),
  decision: z.enum(['ALLOW', 'STEP_UP', 'DECLINE']),
  fired_rules: z.array(z.string()),
});
export type DecisionMessage = z.infer<typeof DecisionMessage>;

export type TransferDto = {
  transferId: string;
  reference: string;
  to: {
    account: string;
    name: string;
    bank: Bank;
  };
  amount: number;
  fee: number;
  content: string;
  status: TransactionStatus;
  declinedFor: string[];
  ts: string;
  decidedAt: string | null;
  balance: number;
};
