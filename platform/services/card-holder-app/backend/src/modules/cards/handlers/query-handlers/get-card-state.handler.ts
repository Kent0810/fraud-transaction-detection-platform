import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../../repositories/cards.repository';
import type { CardStateDto } from '../../types/cards.types';
import { GetCardStateQuery } from '../queries/get-card-state.query';

@QueryHandler(GetCardStateQuery)
export class GetCardStateHandler implements IQueryHandler<GetCardStateQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId }: GetCardStateQuery): Promise<CardStateDto | null> {
    return this.repo.cardState(cardId);
  }
}
