import { Query } from '@nestjs/cqrs';

import type { Page } from '../../../../shared/cassandra/models';
import type { TxnDto } from '../../types/cards.types';

export class GetTransactionsQuery extends Query<Page<TxnDto>> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
    readonly cursor?: string,
  ) {
    super();
  }
}
