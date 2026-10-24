import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../cards.repository';

export class ListCardsQuery extends Query<string[]> {
  constructor(readonly limit: number) {
    super();
  }
}

@QueryHandler(ListCardsQuery)
export class ListCardsHandler implements IQueryHandler<ListCardsQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ limit }: ListCardsQuery): Promise<string[]> {
    return this.repo.cards(limit);
  }
}
