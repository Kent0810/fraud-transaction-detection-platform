import { Query } from '@nestjs/cqrs';

import type { RecipientDto } from '../../types/recipients.types';

export class GetRecipientsQuery extends Query<RecipientDto[]> {
  constructor(readonly cardId: string) {
    super();
  }
}
