import { Query } from '@nestjs/cqrs';

import type { RecentCardDto } from '../../types/ops.types';

export class GetRecentCardsQuery extends Query<RecentCardDto[]> {
  constructor(readonly staffId: number) {
    super();
  }
}
