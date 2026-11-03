import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';

export class ReleaseRecipientCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly recipientId: string,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
