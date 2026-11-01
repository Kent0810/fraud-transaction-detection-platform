import { Query } from '@nestjs/cqrs';

import type { MyQrDto } from '../../types/payments.types';

export class GetMyQrQuery extends Query<MyQrDto> {
  constructor(readonly cardId: string) {
    super();
  }
}
