import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CasesRepository } from '../repositories/cases.repository';
import type { QueueItemDto } from '../types/ops.types';

export class GetQueueQuery extends Query<QueueItemDto[]> {
  constructor(readonly limit: number) {
    super();
  }
}

@QueryHandler(GetQueueQuery)
export class GetQueueHandler implements IQueryHandler<GetQueueQuery> {
  constructor(private readonly cases: CasesRepository) {}

  execute({ limit }: GetQueueQuery): Promise<QueueItemDto[]> {
    return this.cases.queue(limit);
  }
}
