import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';

export class ReleaseMerchantCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly merchant: string,
    readonly by?: StaffAudit,
  ) {
    super();
  }
}
