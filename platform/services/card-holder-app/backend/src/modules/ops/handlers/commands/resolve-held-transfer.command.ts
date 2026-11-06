import { Command } from '@nestjs/cqrs';
import type { HeldOutcome } from '@platform/db';

import { type StaffAudit } from '../../../../shared/prisma/audit';

export class ResolveHeldTransferCommand extends Command<void> {
  constructor(
    readonly cardId: string,
    readonly txnId: string,
    readonly outcome: HeldOutcome,
    readonly by: StaffAudit,
  ) {
    super();
  }
}
