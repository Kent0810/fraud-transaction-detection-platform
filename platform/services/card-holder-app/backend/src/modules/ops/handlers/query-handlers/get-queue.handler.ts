import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CasesRepository } from '../../repositories/cases.repository';
import type { QueueItemDto } from '../../types/ops.types';
import { GetQueueQuery } from '../queries/get-queue.query';

@QueryHandler(GetQueueQuery)
export class GetQueueHandler implements IQueryHandler<GetQueueQuery> {
  constructor(private readonly cases: CasesRepository) {}

  execute({ limit }: GetQueueQuery): Promise<QueueItemDto[]> {
    return this.cases.queue(limit);
  }
}
