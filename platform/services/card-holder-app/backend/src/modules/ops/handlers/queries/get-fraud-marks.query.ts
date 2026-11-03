import { Query } from '@nestjs/cqrs';

import type { FraudMarkDto } from '../../types/ops.types';

export class GetFraudMarksQuery extends Query<FraudMarkDto[]> {
  constructor(readonly limit: number) {
    super();
  }
}
