import { Query } from '@nestjs/cqrs';

export class FindCardQuery extends Query<string | null> {
  constructor(readonly number: string) {
    super();
  }
}
