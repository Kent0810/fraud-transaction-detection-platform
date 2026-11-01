import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AccountsRepository } from '../../repositories/accounts.repository';
import type { AccountHolderDto } from '../../types/accounts.types';
import { GetAccountHolderQuery } from '../queries/get-account-holder.query';

@QueryHandler(GetAccountHolderQuery)
export class GetAccountHolderHandler implements IQueryHandler<GetAccountHolderQuery> {
  constructor(private readonly repo: AccountsRepository) {}

  execute({ accountNumber }: GetAccountHolderQuery): Promise<AccountHolderDto | null> {
    return this.repo.holder(accountNumber);
  }
}
