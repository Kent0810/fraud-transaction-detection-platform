import { Query } from '@nestjs/cqrs';

import type { CardStateDto } from '../../types/cards.types';

export class GetCardStateQuery extends Query<CardStateDto | null> {
  constructor(readonly cardId: string) {
    super();
  }
}
