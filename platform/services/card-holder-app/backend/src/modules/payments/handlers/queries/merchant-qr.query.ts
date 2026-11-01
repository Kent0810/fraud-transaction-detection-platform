import { Query } from '@nestjs/cqrs';

import type { MerchantQrDto } from '../../types/payments.types';

// A query, not a command: issuing a code changes nothing; the code is checked when it is paid.
export class MerchantQrQuery extends Query<MerchantQrDto> {
  constructor(
    readonly merchantId: string,
    readonly amount: number | null,
  ) {
    super();
  }
}
