import { Query } from '@nestjs/cqrs';

import type { AccountHolderDto } from '../../types/accounts.types';

export class GetAccountHolderQuery extends Query<AccountHolderDto | null> {
  constructor(readonly accountNumber: string) {
    super();
  }
}
