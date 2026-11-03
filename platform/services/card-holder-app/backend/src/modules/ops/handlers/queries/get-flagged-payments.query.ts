import { Query } from '@nestjs/cqrs';

import type { FlaggedPaymentDto } from '../../types/ops.types';

export class GetFlaggedPaymentsQuery extends Query<FlaggedPaymentDto[]> {
  constructor(readonly hours: number) {
    super();
  }
}
