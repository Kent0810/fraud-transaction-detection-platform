import type { TransferStatus } from '@platform/db';
import { z } from 'zod';

import { AccountNumber, BankCode, Password, text } from '../../../common/validation';

export { OUR_BANK, type TransferStatus } from '@platform/db';

export type TransferKind = 'INTERNAL' | 'NAPAS';

export const TransferRequest = z.object({
  transferId: z.uuid().transform((id) => id.toLowerCase()),
  toBankCode: BankCode,
  toAccount: AccountNumber,
  toName: text(100),
  // Whole đồng; int() also caps it at Number.MAX_SAFE_INTEGER.
  amount: z.number().int().positive(),
  content: text(140),
  password: Password,
});
export type TransferRequest = z.infer<typeof TransferRequest>;

export const TransferId = z.uuid().transform((id) => id.toLowerCase());

export const TransferDecisionMessage = z.object({
  txn_id: z.uuid(),
  decision: z.enum(['APPROVE', 'DECLINE']),
  fired_rules: z.array(z.string()),
});
export type TransferDecisionMessage = z.infer<typeof TransferDecisionMessage>;

export type TransferDto = {
  transferId: string;
  reference: string;
  kind: TransferKind;
  to: {
    bankCode: string;
    account: string;
    name: string;
  };
  amount: number;
  fee: number;
  content: string;
  status: TransferStatus;
  declinedFor: string[];
  ts: string;
  decidedAt: string | null;
  balance: number;
};
