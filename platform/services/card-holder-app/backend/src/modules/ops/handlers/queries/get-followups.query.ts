import { Query } from '@nestjs/cqrs';

import type { FollowupDto } from '../../types/ops.types';

export class GetFollowupsQuery extends Query<FollowupDto[]> {
  constructor(readonly limit: number) {
    super();
  }
}
