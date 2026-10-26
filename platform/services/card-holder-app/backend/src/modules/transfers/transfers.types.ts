import { z } from 'zod';

import { AccountNumber, BankCode, Password, text } from '../../common/validation';

// This platform's bank code. A transfer to it moves money between two accounts here; any other bank goes out through NAPAS.
// post_transfer() (V6__post_transfer.sql) has the same constant.
export const OUR_BANK = 'HCMMB';

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

// balance is the sender's balance after the transfer.
export type TransferDto = {
  transferId: string;
  reference: string;
  kind: TransferKind;
  to: { bankCode: string; account: string; name: string };
  amount: number;
  fee: number;
  content: string;
  ts: string;
  balance: number;
};
