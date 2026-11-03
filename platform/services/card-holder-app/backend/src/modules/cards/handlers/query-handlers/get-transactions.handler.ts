import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import type { Page } from '../../../../shared/cassandra/models';
import { CardsRepository, forCardholder } from '../../repositories/cards.repository';
import type { TxnDto } from '../../types/cards.types';
import { GetTransactionsQuery } from '../queries/get-transactions.query';

@QueryHandler(GetTransactionsQuery)
export class GetTransactionsHandler implements IQueryHandler<GetTransactionsQuery> {
  constructor(private readonly repo: CardsRepository) {}

  async execute({ cardId, limit, cursor }: GetTransactionsQuery): Promise<Page<TxnDto>> {
    const page = await this.repo.transactionPage(cardId, limit, cursor);
    return { ...page, items: page.items.map(forCardholder) };
  }
}
