import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { QrRepository } from '../../repositories/qr.repository';
import type { MerchantRefDto } from '../../types/payments.types';
import { SearchMerchantsQuery } from '../queries/search-merchants.query';

@QueryHandler(SearchMerchantsQuery)
export class SearchMerchantsHandler implements IQueryHandler<SearchMerchantsQuery> {
  constructor(private readonly qr: QrRepository) {}

  execute({ query }: SearchMerchantsQuery): Promise<MerchantRefDto[]> {
    return Promise.resolve(this.qr.search(query));
  }
}
