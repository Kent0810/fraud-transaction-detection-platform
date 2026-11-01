import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardStatusRepository } from '../../repositories/card-status.repository';
import type { CardStatusDto } from '../../types/controls.types';
import { GetCardStatusQuery } from '../queries/get-card-status.query';

@QueryHandler(GetCardStatusQuery)
export class GetCardStatusHandler implements IQueryHandler<GetCardStatusQuery> {
  constructor(private readonly repo: CardStatusRepository) {}

  execute({ cardId }: GetCardStatusQuery): Promise<CardStatusDto> {
    return this.repo.forCard(cardId);
  }
}
