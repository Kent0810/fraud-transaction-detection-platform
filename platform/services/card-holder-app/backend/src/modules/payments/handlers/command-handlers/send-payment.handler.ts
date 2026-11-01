import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { PaymentsRepository } from '../../repositories/payments.repository';
import type { PaymentDto } from '../../types/payments.types';
import { SendPaymentCommand } from '../commands/send-payment.command';

@CommandHandler(SendPaymentCommand)
export class SendPaymentHandler implements ICommandHandler<SendPaymentCommand> {
  constructor(private readonly payments: PaymentsRepository) {}

  execute({ cardId, request }: SendPaymentCommand): Promise<PaymentDto> {
    return this.payments.request(cardId, request);
  }
}
