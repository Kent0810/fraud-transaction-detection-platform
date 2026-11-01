import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { MerchantsRepository } from '../../repositories/merchants.repository';
import type { MerchantDto } from '../../types/payments.types';
import { GetMerchantsQuery } from '../queries/get-merchants.query';

@QueryHandler(GetMerchantsQuery)
export class GetMerchantsHandler implements IQueryHandler<GetMerchantsQuery> {
  constructor(private readonly merchants: MerchantsRepository) {}

  execute({ cardId }: GetMerchantsQuery): Promise<MerchantDto[]> {
    return this.merchants.nearby(cardId);
  }
}
