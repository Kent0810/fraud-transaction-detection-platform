import { Command } from '@nestjs/cqrs';

import type { PaymentDto, PaymentRequest } from '../../types/payments.types';

// Like a transfer: the payer is the session's card, and the password is asked every time.
export class SendPaymentCommand extends Command<PaymentDto> {
  constructor(
    readonly cardId: string,
    readonly request: PaymentRequest,
  ) {
    super();
  }
}
