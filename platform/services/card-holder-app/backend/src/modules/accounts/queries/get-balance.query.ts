import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { AccountsRepository } from '../accounts.repository';
import type { BalanceDto } from '../accounts.types';

export class GetBalanceQuery extends Query<BalanceDto | null> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetBalanceQuery)
export class GetBalanceHandler implements IQueryHandler<GetBalanceQuery> {
  constructor(private readonly repo: AccountsRepository) {}

  execute({ cardId }: GetBalanceQuery): Promise<BalanceDto | null> {
    return this.repo.balance(cardId);
  }
}
