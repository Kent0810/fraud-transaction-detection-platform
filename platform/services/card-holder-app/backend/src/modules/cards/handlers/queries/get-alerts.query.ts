import { Query } from '@nestjs/cqrs';

import type { AlertDto } from '../../types/cards.types';

export class GetAlertsQuery extends Query<AlertDto[]> {
  constructor(
    readonly cardId: string,
    readonly limit: number,
  ) {
    super();
  }
}
