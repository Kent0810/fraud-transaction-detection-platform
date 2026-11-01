import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardholderFilesRepository } from '../../repositories/cardholder-files.repository';
import { FindCardQuery } from '../queries/find-card.query';

@QueryHandler(FindCardQuery)
export class FindCardHandler implements IQueryHandler<FindCardQuery> {
  constructor(private readonly files: CardholderFilesRepository) {}

  execute({ number }: FindCardQuery): Promise<string | null> {
    return this.files.lookup(number);
  }
}
