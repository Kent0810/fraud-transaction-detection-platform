import { Query } from '@nestjs/cqrs';

import type { CardStatusDto } from '../../types/controls.types';

export class GetCardStatusQuery extends Query<CardStatusDto> {
  constructor(readonly cardId: string) {
    super();
  }
}
