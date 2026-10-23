import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../cards.repository';

export class CardExistsQuery extends Query<boolean> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(CardExistsQuery)
export class CardExistsHandler implements IQueryHandler<CardExistsQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId }: CardExistsQuery): Promise<boolean> {
    return this.repo.exists(cardId);
  }
}
