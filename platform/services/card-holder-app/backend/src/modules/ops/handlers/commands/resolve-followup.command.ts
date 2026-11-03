import { Command } from '@nestjs/cqrs';

import { type StaffAudit } from '../../../../shared/prisma/audit';

export class ResolveFollowupCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly txnId: string,
    readonly outcome: 'GENUINE' | 'FRAUD',
    readonly by: StaffAudit,
  ) {
    super();
  }
}
