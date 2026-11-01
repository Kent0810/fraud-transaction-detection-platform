import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { TransfersRepository } from '../../repositories/transfers.repository';
import type { TransferDto } from '../../types/transfers.types';
import { GetTransferQuery } from '../queries/get-transfer.query';

@QueryHandler(GetTransferQuery)
export class GetTransferHandler implements IQueryHandler<GetTransferQuery> {
  constructor(private readonly transfers: TransfersRepository) {}

  execute({ cardId, transferId }: GetTransferQuery): Promise<TransferDto | null> {
    return this.transfers.forCard(cardId, transferId);
  }
}
