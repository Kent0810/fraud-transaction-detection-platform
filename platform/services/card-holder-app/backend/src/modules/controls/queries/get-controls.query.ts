import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { ControlsRepository } from '../repositories/controls.repository';
import type { ControlsDto } from '../types/controls.types';

export class GetControlsQuery extends Query<ControlsDto> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetControlsQuery)
export class GetControlsHandler implements IQueryHandler<GetControlsQuery> {
  constructor(private readonly repo: ControlsRepository) {}

  execute({ cardId }: GetControlsQuery): Promise<ControlsDto> {
    return this.repo.forCard(cardId);
  }
}
