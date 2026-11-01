import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';

export class ReviewAlertCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly alertId: string,
    readonly ts: string,
    readonly status: 'CONFIRMED' | 'CLEARED',
    readonly by: StaffAudit,
  ) {
    super();
  }
}
