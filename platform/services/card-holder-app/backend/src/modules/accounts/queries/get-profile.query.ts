import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AccountsRepository } from '../repositories/accounts.repository';
import type { ProfileDto } from '../types/accounts.types';

export class GetProfileQuery extends Query<ProfileDto | null> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly repo: AccountsRepository) {}

  execute({ cardId }: GetProfileQuery): Promise<ProfileDto | null> {
    return this.repo.profile(cardId);
  }
}
