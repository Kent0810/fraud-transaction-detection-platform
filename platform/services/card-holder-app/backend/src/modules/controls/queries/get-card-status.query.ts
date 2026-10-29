import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardStatusRepository } from '../repositories/card-status.repository';
import type { CardStatusDto } from '../types/controls.types';

export class GetCardStatusQuery extends Query<CardStatusDto> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetCardStatusQuery)
export class GetCardStatusHandler implements IQueryHandler<GetCardStatusQuery> {
  constructor(private readonly repo: CardStatusRepository) {}

  execute({ cardId }: GetCardStatusQuery): Promise<CardStatusDto> {
    return this.repo.forCard(cardId);
  }
}
