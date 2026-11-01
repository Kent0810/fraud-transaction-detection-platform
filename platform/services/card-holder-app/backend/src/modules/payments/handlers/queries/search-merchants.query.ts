import { Query } from '@nestjs/cqrs';

import type { MerchantRefDto } from '../../types/payments.types';

export class SearchMerchantsQuery extends Query<MerchantRefDto[]> {
  constructor(readonly query: string | undefined) {
    super();
  }
}
