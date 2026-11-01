import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { ControlsRepository } from '../../repositories/controls.repository';
import type { ControlsDto } from '../../types/controls.types';
import { GetControlsQuery } from '../queries/get-controls.query';

@QueryHandler(GetControlsQuery)
export class GetControlsHandler implements IQueryHandler<GetControlsQuery> {
  constructor(private readonly repo: ControlsRepository) {}

  execute({ cardId }: GetControlsQuery): Promise<ControlsDto> {
    return this.repo.forCard(cardId);
  }
}
