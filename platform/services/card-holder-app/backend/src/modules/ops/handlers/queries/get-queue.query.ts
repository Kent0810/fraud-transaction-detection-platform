import { Query } from '@nestjs/cqrs';

import type { QueueItemDto } from '../../types/ops.types';

export class GetQueueQuery extends Query<QueueItemDto[]> {
  constructor(readonly limit: number) {
    super();
  }
}
