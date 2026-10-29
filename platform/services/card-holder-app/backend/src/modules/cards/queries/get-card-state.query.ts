import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../repositories/cards.repository';
import type { CardStateDto } from '../types/cards.types';

export class GetCardStateQuery extends Query<CardStateDto | null> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetCardStateQuery)
export class GetCardStateHandler implements IQueryHandler<GetCardStateQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId }: GetCardStateQuery): Promise<CardStateDto | null> {
    return this.repo.cardState(cardId);
  }
}
