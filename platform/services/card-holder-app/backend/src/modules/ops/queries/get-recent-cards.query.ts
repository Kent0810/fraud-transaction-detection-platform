import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardholderFilesRepository } from '../repositories/cardholder-files.repository';
import type { RecentCardDto } from '../types/ops.types';

export class GetRecentCardsQuery extends Query<RecentCardDto[]> {
  constructor(readonly staffId: number) {
    super();
  }
}

@QueryHandler(GetRecentCardsQuery)
export class GetRecentCardsHandler implements IQueryHandler<GetRecentCardsQuery> {
  constructor(private readonly files: CardholderFilesRepository) {}

  execute({ staffId }: GetRecentCardsQuery): Promise<RecentCardDto[]> {
    return this.files.recentlyOpened(staffId, 8);
  }
}
