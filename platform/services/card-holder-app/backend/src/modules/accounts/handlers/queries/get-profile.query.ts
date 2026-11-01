import { Query } from '@nestjs/cqrs';

import type { ProfileDto } from '../../types/accounts.types';

export class GetProfileQuery extends Query<ProfileDto | null> {
  constructor(readonly cardId: string) {
    super();
  }
}
