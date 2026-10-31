import { Module } from '@nestjs/common';

import { SendPaymentHandler } from './commands/send-payment.command';
import { PaymentsController } from './payments.controller';
import { GetMerchantsHandler } from './queries/get-merchants.query';
import { GetPaymentHandler } from './queries/get-payment.query';
import { GetMyQrHandler, MerchantQrHandler, ResolveQrHandler, SearchMerchantsHandler } from './queries/qr.queries';
import { QrController } from './qr.controller';
import { MerchantsRepository } from './repositories/merchants.repository';
import { PaymentsRepository } from './repositories/payments.repository';
import { QrRepository } from './repositories/qr.repository';

// Card payments made in the app, and the QR codes that start them. Settling them is the transfers module's decisions consumer: it settles every channel.
@Module({
  controllers: [PaymentsController, QrController],
  providers: [
    MerchantsRepository,
    PaymentsRepository,
    QrRepository,
    SendPaymentHandler,
    GetPaymentHandler,
    GetMerchantsHandler,
    GetMyQrHandler,
    ResolveQrHandler,
    SearchMerchantsHandler,
    MerchantQrHandler,
  ],
})
export class PaymentsModule {}
