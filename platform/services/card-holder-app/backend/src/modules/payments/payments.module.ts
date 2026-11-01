import { Module } from '@nestjs/common';

import { SendPaymentHandler } from './handlers/command-handlers/send-payment.handler';
import { GetMerchantsHandler } from './handlers/query-handlers/get-merchants.handler';
import { GetMyQrHandler } from './handlers/query-handlers/get-my-qr.handler';
import { GetPaymentHandler } from './handlers/query-handlers/get-payment.handler';
import { MerchantQrHandler } from './handlers/query-handlers/merchant-qr.handler';
import { ResolveQrHandler } from './handlers/query-handlers/resolve-qr.handler';
import { SearchMerchantsHandler } from './handlers/query-handlers/search-merchants.handler';
import { PaymentsController } from './payments.controller';
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
