import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository, forCardholder } from '../../repositories/cards.repository';
import type { TxnDto } from '../../types/cards.types';
import { GetTransactionQuery } from '../queries/get-transaction.query';

@QueryHandler(GetTransactionQuery)
export class GetTransactionHandler implements IQueryHandler<GetTransactionQuery> {
  constructor(private readonly repo: CardsRepository) {}

  async execute({ cardId, txnId }: GetTransactionQuery): Promise<TxnDto | null> {
    const txn = await this.repo.transaction(cardId, txnId);
    return txn && forCardholder(txn);
  }
}
