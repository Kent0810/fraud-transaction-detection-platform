import { Injectable } from '@nestjs/common';
import { getPayment, requestPayment, type TransactionState, type TransactionStatus } from '@platform/db';

import { asHttpError } from '../../../common/refusals';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { PaymentDto, PaymentRequest } from '../types/payments.types';
import { MerchantsRepository } from './merchants.repository';

const toDto = (r: TransactionState): PaymentDto => ({
  paymentId: r.txn_id,
  reference: r.reference,
  merchant: r.merchant ?? '',
  category: r.category ?? '',
  amount: Number(r.amount),
  status: r.status as TransactionStatus,
  declinedFor: r.declined_for,
  ts: r.created_at.toISOString(),
  decidedAt: r.decided_at?.toISOString() ?? null,
  balance: Number(r.balance),
});

@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly merchants: MerchantsRepository,
  ) {}

  async request(fromCard: string, p: PaymentRequest): Promise<PaymentDto> {
    const m = await this.merchants.find(fromCard, p.merchantId);
    try {
      return toDto(
        await requestPayment(this.db.client, {
          fromCard,
          password: p.password,
          paymentId: p.paymentId,
          merchant: m.name,
          category: m.category,
          amount: p.amount,
          merchLat: m.lat,
          merchLong: m.long,
        }),
      );
    } catch (e) {
      throw asHttpError(e);
    }
  }

  async forCard(fromCard: string, paymentId: string): Promise<PaymentDto | null> {
    const p = await getPayment(this.db.client, fromCard, paymentId);
    return p && toDto(p);
  }
}
