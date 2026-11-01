import { Query } from '@nestjs/cqrs';

import type { AuditEntryDto } from '../../types/ops.types';

export class GetAuditTrailQuery extends Query<AuditEntryDto[]> {
  constructor(readonly cardId: string) {
    super();
  }
}
