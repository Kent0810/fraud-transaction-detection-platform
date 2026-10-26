import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AccountsRepository } from '../repositories/accounts.repository';
import type { AccountHolderDto } from '../accounts.types';

export class GetAccountHolderQuery extends Query<AccountHolderDto | null> {
  constructor(readonly accountNumber: string) {
    super();
  }
}

@QueryHandler(GetAccountHolderQuery)
export class GetAccountHolderHandler implements IQueryHandler<GetAccountHolderQuery> {
  constructor(private readonly repo: AccountsRepository) {}

  execute({ accountNumber }: GetAccountHolderQuery): Promise<AccountHolderDto | null> {
    return this.repo.holder(accountNumber);
  }
}
