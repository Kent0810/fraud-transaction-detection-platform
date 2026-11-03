import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { FollowupsRepository } from '../../repositories/followups.repository';
import type { FollowupDto } from '../../types/ops.types';
import { GetFollowupsQuery } from '../queries/get-followups.query';

@QueryHandler(GetFollowupsQuery)
export class GetFollowupsHandler implements IQueryHandler<GetFollowupsQuery> {
  constructor(private readonly repo: FollowupsRepository) {}

  execute({ limit }: GetFollowupsQuery): Promise<FollowupDto[]> {
    return this.repo.recent(limit);
  }
}
