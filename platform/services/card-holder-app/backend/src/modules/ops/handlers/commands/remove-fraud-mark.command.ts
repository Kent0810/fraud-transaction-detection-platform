import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';

export class RemoveFraudMarkCommand extends Command<void> {
  constructor(
    readonly recipientId: string,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
