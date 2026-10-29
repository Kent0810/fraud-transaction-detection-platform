import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardholderFilesRepository } from '../repositories/cardholder-files.repository';

export class FindCardQuery extends Query<string | null> {
  constructor(readonly number: string) {
    super();
  }
}

@QueryHandler(FindCardQuery)
export class FindCardHandler implements IQueryHandler<FindCardQuery> {
  constructor(private readonly files: CardholderFilesRepository) {}

  execute({ number }: FindCardQuery): Promise<string | null> {
    return this.files.lookup(number);
  }
}
