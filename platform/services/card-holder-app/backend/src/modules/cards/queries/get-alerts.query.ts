import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../cards.repository';
import type { AlertDto } from '../cards.types';

export class GetAlertsQuery extends Query<AlertDto[]> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
  ) {
    super();
  }
}

@QueryHandler(GetAlertsQuery)
export class GetAlertsHandler implements IQueryHandler<GetAlertsQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId, limit }: GetAlertsQuery): Promise<AlertDto[]> {
    return this.repo.alerts(cardId, limit);
  }
}
