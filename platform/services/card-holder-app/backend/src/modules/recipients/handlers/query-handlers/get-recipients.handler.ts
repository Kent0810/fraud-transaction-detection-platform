import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { RecipientsRepository } from '../../repositories/recipients.repository';
import type { RecipientDto } from '../../types/recipients.types';
import { GetRecipientsQuery } from '../queries/get-recipients.query';

@QueryHandler(GetRecipientsQuery)
export class GetRecipientsHandler implements IQueryHandler<GetRecipientsQuery> {
  constructor(private readonly repo: RecipientsRepository) {}

  execute({ cardId }: GetRecipientsQuery): Promise<RecipientDto[]> {
    return this.repo.forCard(cardId);
  }
}
