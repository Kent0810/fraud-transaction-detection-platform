import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { QrRepository } from '../../repositories/qr.repository';
import type { MerchantQrDto } from '../../types/payments.types';
import { MerchantQrQuery } from '../queries/merchant-qr.query';

@QueryHandler(MerchantQrQuery)
export class MerchantQrHandler implements IQueryHandler<MerchantQrQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ merchantId, amount }: MerchantQrQuery): Promise<MerchantQrDto> {
    return Promise.resolve(this.qr.merchantCode(merchantId, amount));
  }
}
