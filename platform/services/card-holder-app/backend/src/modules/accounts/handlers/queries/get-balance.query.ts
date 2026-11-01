import { Query } from '@nestjs/cqrs';

import type { BalanceDto } from '../../types/accounts.types';

export class GetBalanceQuery extends Query<BalanceDto | null> {
  constructor(readonly cardId: string) {
    super();
  }
}
