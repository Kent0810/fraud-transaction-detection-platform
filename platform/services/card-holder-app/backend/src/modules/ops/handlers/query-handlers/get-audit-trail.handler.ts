import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { CardholderFilesRepository } from '../../repositories/cardholder-files.repository';
import type { AuditEntryDto } from '../../types/ops.types';
import { GetAuditTrailQuery } from '../queries/get-audit-trail.query';

@QueryHandler(GetAuditTrailQuery)
export class GetAuditTrailHandler implements IQueryHandler<GetAuditTrailQuery> {
  constructor(private readonly files: CardholderFilesRepository) {}

  execute({ cardId }: GetAuditTrailQuery): Promise<AuditEntryDto[]> {
    return this.files.auditTrail(cardId, 50);
  }
}
