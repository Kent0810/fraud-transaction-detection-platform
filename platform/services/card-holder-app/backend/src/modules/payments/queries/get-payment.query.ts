import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { PaymentsRepository } from '../repositories/payments.repository';
import type { PaymentDto } from '../types/payments.types';

export class GetPaymentQuery extends Query<PaymentDto | null> {
  constructor(
    readonly cardId: string,
    readonly paymentId: string,
  ) {
    super();
  }
}

@QueryHandler(GetPaymentQuery)
export class GetPaymentHandler implements IQueryHandler<GetPaymentQuery> {
  constructor(private readonly payments: PaymentsRepository) {}

  execute({ cardId, paymentId }: GetPaymentQuery): Promise<PaymentDto | null> {
    return this.payments.forCard(cardId, paymentId);
  }
}
