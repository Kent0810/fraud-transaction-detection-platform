import type { Bank, TransactionStatus } from '@platform/db';
import { z } from 'zod';

import { Password } from '../../../common/validation';

export const MerchantId = z.string().regex(/^\d{1,6}$/, 'must be a merchant id');

export const PaymentRequest = z.object({
  paymentId: z.uuid().transform((id) => id.toLowerCase()),
  merchantId: MerchantId,
  // Whole đồng; int() also caps it at Number.MAX_SAFE_INTEGER.
  amount: z.number().int().positive(),
  password: Password,
  // The scanned code, when paying by QR: a dynamic code's amount must be paid exactly.
  qr: z.string().trim().max(512).optional(),
});
export type PaymentRequest = z.infer<typeof PaymentRequest>;

export const PaymentId = z.uuid().transform((id) => id.toLowerCase());

export type MerchantDto = {
  merchantId: string;
  name: string;
  category: string;
  /** From the cardholder's home; null when the home is unknown. */
  distanceKm: number | null;
};

export type PaymentDto = {
  paymentId: string;
  reference: string;
  merchant: string;
  category: string;
  amount: number;
  status: TransactionStatus;
  declinedFor: string[];
  ts: string;
  decidedAt: string | null;
  balance: number;
};

export const QrPayload = z.string().trim().min(8).max(512);

export const ResolveQrRequest = z.object({ payload: QrPayload });
export type ResolveQrRequest = z.infer<typeof ResolveQrRequest>;

export const MerchantQrRequest = z.object({
  // Set: a dynamic code with this amount, valid for a few minutes. Unset: a static code, the payer types the amount.
  amount: z.number().int().positive().nullish(),
});
export type MerchantQrRequest = z.infer<typeof MerchantQrRequest>;

export const MerchantSearch = z.string().trim().max(80).optional();

/** The signed-in cardholder's own code, for receiving transfers. */
export type MyQrDto = {
  payload: string;
  account: string;
  name: string;
};

/** What a scanned code points at, checked against this bank. */
export type QrTargetDto =
  | { kind: 'TRANSFER'; account: string; name: string; amount: number | null; note: string | null }
  // qr: send it back with the payment, so the bank holds the payer to the code's amount.
  | { kind: 'MERCHANT'; merchant: MerchantDto; amount: number | null; qr: string }
  | {
      kind: 'OTHER_BANK';
      bin: string;
      // Null for a bank a transfer can't reach; such a code can only be read.
      bank: Bank | null;
      account: string;
      toCard: boolean;
      name: string | null;
      amount: number | null;
      note: string | null;
    };

export type MerchantRefDto = { merchantId: string; name: string; category: string };

export type MerchantQrDto = {
  payload: string;
  merchant: MerchantRefDto;
  amount: number | null;
  expiresAt: string | null;
};
