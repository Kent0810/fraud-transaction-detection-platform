import { Query } from '@nestjs/cqrs';

import type { PaymentDto } from '../../types/payments.types';

export class GetPaymentQuery extends Query<PaymentDto | null> {
  constructor(
    readonly cardId: string,
    readonly paymentId: string,
  ) {
    super();
  }
}
