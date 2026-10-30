import type { TransactionStatus } from '@platform/db';
import { z } from 'zod';

import { Password } from '../../../common/validation';

export const MerchantId = z.string().regex(/^\d{1,6}$/, 'must be a merchant id');

export const PaymentRequest = z.object({
  paymentId: z.uuid().transform((id) => id.toLowerCase()),
  merchantId: MerchantId,
  // Whole đồng; int() also caps it at Number.MAX_SAFE_INTEGER.
  amount: z.number().int().positive(),
  password: Password,
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
