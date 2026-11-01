import { Query } from '@nestjs/cqrs';

import type { QrTargetDto } from '../../types/payments.types';

export class ResolveQrQuery extends Query<QrTargetDto> {
  constructor(
    readonly cardId: string,
    readonly payload: string,
  ) {
    super();
  }
}
