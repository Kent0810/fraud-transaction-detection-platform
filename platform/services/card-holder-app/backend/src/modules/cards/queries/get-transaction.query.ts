import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../cards.repository';
import type { TxnDto } from '../cards.types';

export class GetTransactionQuery extends Query<TxnDto | null> {
  constructor(
    readonly cardId: string,
    readonly txnId: string,
  ) {
    super();
  }
}

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler implements IQueryHandler<GetTransactionQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId, txnId }: GetTransactionQuery): Promise<TxnDto | null> {
    return this.repo.transaction(cardId, txnId);
  }
}
