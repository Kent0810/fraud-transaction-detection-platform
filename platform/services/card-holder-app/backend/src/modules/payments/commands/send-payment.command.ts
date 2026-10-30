import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { PaymentsRepository } from '../repositories/payments.repository';
import type { PaymentDto, PaymentRequest } from '../types/payments.types';

// Like a transfer: the payer is the session's card, and the password is asked every time.
export class SendPaymentCommand extends Command<PaymentDto> {
  constructor(
    readonly cardId: string,
    readonly request: PaymentRequest,
  ) {
    super();
  }
}

@CommandHandler(SendPaymentCommand)
export class SendPaymentHandler implements ICommandHandler<SendPaymentCommand> {
  constructor(private readonly payments: PaymentsRepository) {}

  execute({ cardId, request }: SendPaymentCommand): Promise<PaymentDto> {
    return this.payments.request(cardId, request);
  }
}
