import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { RecipientsRepository } from '../repositories/recipients.repository';
import type { RecipientDto } from '../recipients.types';

export class GetRecipientsQuery extends Query<RecipientDto[]> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetRecipientsQuery)
export class GetRecipientsHandler implements IQueryHandler<GetRecipientsQuery> {
  constructor(private readonly repo: RecipientsRepository) {}

  execute({ cardId }: GetRecipientsQuery): Promise<RecipientDto[]> {
    return this.repo.forCard(cardId);
  }
}
