import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardsRepository } from '../../repositories/cards.repository';
import type { AlertDto } from '../../types/cards.types';
import { GetAlertsQuery } from '../queries/get-alerts.query';

@QueryHandler(GetAlertsQuery)
export class GetAlertsHandler implements IQueryHandler<GetAlertsQuery> {
  constructor(private readonly repo: CardsRepository) {}

  execute({ cardId, limit }: GetAlertsQuery): Promise<AlertDto[]> {
    return this.repo.alerts(cardId, limit);
  }
}
