import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { PaymentsRepository } from '../../repositories/payments.repository';
import type { PaymentDto } from '../../types/payments.types';
import { GetPaymentQuery } from '../queries/get-payment.query';

@QueryHandler(GetPaymentQuery)
export class GetPaymentHandler implements IQueryHandler<GetPaymentQuery> {
  constructor(private readonly payments: PaymentsRepository) {}

  execute({ cardId, paymentId }: GetPaymentQuery): Promise<PaymentDto | null> {
    return this.payments.forCard(cardId, paymentId);
  }
}
