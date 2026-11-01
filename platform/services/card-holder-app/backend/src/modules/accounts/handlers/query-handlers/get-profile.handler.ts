import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AccountsRepository } from '../../repositories/accounts.repository';
import type { ProfileDto } from '../../types/accounts.types';
import { GetProfileQuery } from '../queries/get-profile.query';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly repo: AccountsRepository) {}

  execute({ cardId }: GetProfileQuery): Promise<ProfileDto | null> {
    return this.repo.profile(cardId);
  }
}
