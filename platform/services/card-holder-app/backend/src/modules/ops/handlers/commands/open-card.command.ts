import { Command } from '@nestjs/cqrs';

import type { StaffAudit } from '../../../../shared/prisma/audit';
import type { CardViewDto } from '../../types/ops.types';

// A command, not a query: opening a card writes VIEW_CARDHOLDER to the audit log.
export class OpenCardCommand extends Command<CardViewDto | null> {
  constructor(
    readonly cardId: string,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
