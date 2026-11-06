import { Query } from '@nestjs/cqrs';

import type { HeldTransferDto } from '../../types/ops.types';

export class GetHeldTransfersQuery extends Query<HeldTransferDto[]> {
  constructor(readonly cardId?: string) {
    super();
  }
}
