import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { MerchantsRepository } from '../repositories/merchants.repository';
import type { MerchantDto } from '../types/payments.types';

export class GetMerchantsQuery extends Query<MerchantDto[]> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetMerchantsQuery)
export class GetMerchantsHandler implements IQueryHandler<GetMerchantsQuery> {
  constructor(private readonly merchants: MerchantsRepository) {}

  execute({ cardId }: GetMerchantsQuery): Promise<MerchantDto[]> {
    return this.merchants.nearby(cardId);
  }
}
