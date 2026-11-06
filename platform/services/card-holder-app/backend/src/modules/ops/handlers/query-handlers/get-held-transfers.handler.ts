import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { HeldTransfersRepository } from '../../repositories/held-transfers.repository';
import type { HeldTransferDto } from '../../types/ops.types';
import { GetHeldTransfersQuery } from '../queries/get-held-transfers.query';

@QueryHandler(GetHeldTransfersQuery)
export class GetHeldTransfersHandler implements IQueryHandler<GetHeldTransfersQuery> {
  constructor(private readonly repo: HeldTransfersRepository) {}

  execute({ cardId }: GetHeldTransfersQuery): Promise<HeldTransferDto[]> {
    return this.repo.list(cardId);
  }
}
