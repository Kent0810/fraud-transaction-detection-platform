import { Module } from '@nestjs/common';

import { SendPaymentHandler } from './commands/send-payment.command';
import { PaymentsController } from './payments.controller';
import { GetMerchantsHandler } from './queries/get-merchants.query';
import { GetPaymentHandler } from './queries/get-payment.query';
import { MerchantsRepository } from './repositories/merchants.repository';
import { PaymentsRepository } from './repositories/payments.repository';

// Card payments made in the app. Settling them is the transfers module's decisions consumer: it settles every channel.
@Module({
  controllers: [PaymentsController],
  providers: [MerchantsRepository, PaymentsRepository, SendPaymentHandler, GetPaymentHandler, GetMerchantsHandler],
})
export class PaymentsModule {}
