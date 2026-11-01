import { Query } from '@nestjs/cqrs';

import type { TransferDto } from '../../types/transfers.types';

export class GetTransferQuery extends Query<TransferDto | null> {
  constructor(
    readonly cardId: string,
    readonly transferId: string,
  ) {
    super();
  }
}
