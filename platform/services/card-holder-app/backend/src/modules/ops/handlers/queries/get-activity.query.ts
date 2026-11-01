import { Query } from '@nestjs/cqrs';

import type { ActivityDto } from '../../types/ops.types';

export class GetActivityQuery extends Query<ActivityDto[]> {
  constructor(
    readonly cardId: string,
    readonly days: number,
  ) {
    super();
  }
}
