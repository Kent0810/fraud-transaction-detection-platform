import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { AccountsRepository } from '../../repositories/accounts.repository';
import type { BalanceDto } from '../../types/accounts.types';
import { GetBalanceQuery } from '../queries/get-balance.query';

@QueryHandler(GetBalanceQuery)
export class GetBalanceHandler implements IQueryHandler<GetBalanceQuery> {
  constructor(private readonly repo: AccountsRepository) {}

  execute({ cardId }: GetBalanceQuery): Promise<BalanceDto | null> {
    return this.repo.balance(cardId);
  }
}
