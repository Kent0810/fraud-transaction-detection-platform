import { Query } from '@nestjs/cqrs';

import type { TxnDto } from '../../types/cards.types';

export class GetTransactionQuery extends Query<TxnDto | null> {
  constructor(
    readonly cardId: string,
    readonly txnId: string,
  ) {
    super();
  }
}
