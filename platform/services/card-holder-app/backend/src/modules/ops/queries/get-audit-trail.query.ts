import { type IQueryHandler, Query, QueryHandler } from '@nestjs/cqrs';

import { CardholderFilesRepository } from '../repositories/cardholder-files.repository';
import type { AuditEntryDto } from '../types/ops.types';

export class GetAuditTrailQuery extends Query<AuditEntryDto[]> {
  constructor(readonly cardId: string) {
    super();
  }
}

@QueryHandler(GetAuditTrailQuery)
export class GetAuditTrailHandler implements IQueryHandler<GetAuditTrailQuery> {
  constructor(private readonly files: CardholderFilesRepository) {}

  execute({ cardId }: GetAuditTrailQuery): Promise<AuditEntryDto[]> {
    return this.files.auditTrail(cardId, 50);
  }
}
