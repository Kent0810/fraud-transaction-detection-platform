import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../../repositories/cards.repository';
import type { TxnDto } from '../../types/cards.types';
import { GetTransactionQuery } from '../queries/get-transaction.query';

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler implements IQueryHandler<GetTransactionQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId, txnId }: GetTransactionQuery): Promise<TxnDto | null> {
    return this.repo.transaction(cardId, txnId);
  }
}
