import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CasesRepository } from '../repositories/cases.repository';
import type { ActivityDto } from '../types/ops.types';

export class GetActivityQuery extends Query<ActivityDto[]> {
  constructor(
    readonly cardId: string,
    readonly days: number,
  ) {
    super();
  }
}

@QueryHandler(GetActivityQuery)
export class GetActivityHandler implements IQueryHandler<GetActivityQuery> {
  constructor(private readonly cases: CasesRepository) {}

  execute({ cardId, days }: GetActivityQuery): Promise<ActivityDto[]> {
    return this.cases.activity(cardId, days);
  }
}
