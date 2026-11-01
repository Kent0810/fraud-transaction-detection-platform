import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CasesRepository } from '../../repositories/cases.repository';
import type { ActivityDto } from '../../types/ops.types';
import { GetActivityQuery } from '../queries/get-activity.query';

@QueryHandler(GetActivityQuery)
export class GetActivityHandler implements IQueryHandler<GetActivityQuery> {
  constructor(private readonly cases: CasesRepository) {}

  execute({ cardId, days }: GetActivityQuery): Promise<ActivityDto[]> {
    return this.cases.activity(cardId, days);
  }
}
