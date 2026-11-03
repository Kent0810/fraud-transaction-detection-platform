import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { FollowupsRepository } from '../../repositories/followups.repository';
import type { FraudMarkDto } from '../../types/ops.types';
import { GetFraudMarksQuery } from '../queries/get-fraud-marks.query';

@QueryHandler(GetFraudMarksQuery)
export class GetFraudMarksHandler implements IQueryHandler<GetFraudMarksQuery> {
  constructor(private readonly repo: FollowupsRepository) {}

  execute({ limit }: GetFraudMarksQuery): Promise<FraudMarkDto[]> {
    return this.repo.marks(limit);
  }
}
