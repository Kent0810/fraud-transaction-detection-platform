import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { TransfersRepository } from '../repositories/transfers.repository';
import type { TransferDto } from '../types/transfers.types';

export class GetTransferQuery extends Query<TransferDto | null> {
  constructor(
    readonly cardId: string,
    readonly transferId: string,
  ) {
    super();
  }
}

@QueryHandler(GetTransferQuery)
export class GetTransferHandler implements IQueryHandler<GetTransferQuery> {
  constructor(private readonly transfers: TransfersRepository) {}

  execute({ cardId, transferId }: GetTransferQuery): Promise<TransferDto | null> {
    return this.transfers.forCard(cardId, transferId);
  }
}
