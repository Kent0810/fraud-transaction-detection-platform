import { Query } from '@nestjs/cqrs';

import type { MerchantDto } from '../../types/payments.types';

export class GetMerchantsQuery extends Query<MerchantDto[]> {
  constructor(readonly cardId: string) {
    super();
  }
}
