import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import type { Page } from '../../../shared/cassandra/models';
import { CardsRepository } from '../repositories/cards.repository';
import type { TxnDto } from '../cards.types';

export class GetTransactionsQuery extends Query<Page<TxnDto>> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
    readonly cursor?: string,
  ) {
    super();
  }
}

@QueryHandler(GetTransactionsQuery)
export class GetTransactionsHandler implements IQueryHandler<GetTransactionsQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId, limit, cursor }: GetTransactionsQuery): Promise<Page<TxnDto>> {
    return this.repo.transactionPage(cardId, limit, cursor);
  }
}
